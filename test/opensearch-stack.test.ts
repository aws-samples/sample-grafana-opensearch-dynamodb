import { Annotations, Match } from 'aws-cdk-lib/assertions';
import { App, Aspects, Stack } from 'aws-cdk-lib';
import { AwsSolutionsChecks, NagSuppressions } from 'cdk-nag';
import { OpenSearchStack } from '../lib/opensearch-stack';

describe('cdk-nag AwsSolutions Pack', () => {
  let openSearchStack: OpenSearchStack;
  let app: App;
  // In this case we can use beforeAll() over beforeEach() since our tests 
  // do not modify the state of the application 
  beforeAll(() => {
    // GIVEN
    app = new App();
    openSearchStack = new OpenSearchStack(app, 'OpenSearchStack', {
      dynamoDBTableArn: 'arn:aws:dynamodb:us-east-1:123456789012:table/movies-datastore', //Dummy ARN value for test
      openSearchDomainName: 'movies-search', //Dummy name for test
      openSearchIndexName: 'movies' //Dummy name for test
    })

    NagSuppressions.addStackSuppressions(openSearchStack, [
      {
        id: 'AwsSolutions-L1',
        reason: 'Custom resource Lambda is managed by CDK'
      },
      {
        id: 'AwsSolutions-IAM4',
        reason: 'Managed policies are required for this use case'
      },
      {
        id: 'AwsSolutions-IAM5',
        reason: 'DynamoDB Stream ARNs require /* suffix to capture all streams for the table',
        appliesTo: ['Resource::arn:aws:dynamodb:us-east-1:123456789012:table/movies-datastore/stream/*']
      },
      {
        id: 'AwsSolutions-IAM5',
        reason: 'Required for listing DynamoDB tables and streams at account level. Used for List level permissions only.',
        appliesTo: ['Resource::*']
      },
      {
        id: 'AwsSolutions-IAM5',
        reason: 'Required for OpenSearch domain access including all indices and API operations',
        appliesTo: [
          'Resource::arn:aws:es:<AWS::Region>:<AWS::AccountId>:domain/movies-search/*',
          'Resource::<OpenSearchDomain85D65221.Arn>/*',
          'Resource::<OpenSearchDomain85D65221.Arn>/*/*'
        ]
      },
      {
        id: 'AwsSolutions-IAM5',
        reason: 'Required KMS permissions to allow OpenSearch service principals to describe the key',
        appliesTo: [
          'Action::kms:List*',
          'Action::kms:Describe*'
        ]
      },
      {
        id: 'AwsSolutions-SMG4',
        reason: 'Secrets rotation is not handled as this is a short lived non-production use case'
      },
      {
        id: 'AwsSolutions-OS1',
        reason: 'Domain is intentionally public for this short lived non-production use case and secured through other mechanisms'
      },
      {
        id: 'AwsSolutions-OS3',
        reason: 'Access is controlled through IAM policies and security groups instead of IP allowlisting'
      },
      {
        id: 'AwsSolutions-OS4',
        reason: 'Non-production environment - dedicated master nodes not required for non-production use'
      },
      {
        id: 'AwsSolutions-OS5',
        reason: 'Domain uses IAM authentication and fine-grained access control instead of IP restrictions'
      }
    ]);

    // WHEN
    Aspects.of(openSearchStack).add(new AwsSolutionsChecks());
  });

  // THEN
  test('No unsuppressed Warnings', () => {
    const warnings = Annotations.fromStack(openSearchStack).findWarning(
      '*',
      Match.stringLikeRegexp('AwsSolutions-.*')
    );
    expect(warnings).toHaveLength(0);
  });

  test('No unsuppressed Errors', () => {
    const errors = Annotations.fromStack(openSearchStack).findError(
      '*',
      Match.stringLikeRegexp('AwsSolutions-.*')
    );
    console.log(JSON.stringify(errors, null, 2))
    expect(errors).toHaveLength(0);
  });
});
