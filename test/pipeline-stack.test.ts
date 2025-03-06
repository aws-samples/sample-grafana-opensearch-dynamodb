import { Annotations, Match } from 'aws-cdk-lib/assertions';
import { App, Aspects, Stack } from 'aws-cdk-lib';
import { AwsSolutionsChecks } from 'cdk-nag';
import { PipelineStack } from '../lib/pipeline-stack';

describe('cdk-nag AwsSolutions Pack', () => {
  let pipelineStack: PipelineStack;
  let app: App;
  // In this case we can use beforeAll() over beforeEach() since our tests 
  // do not modify the state of the application 
  beforeAll(() => {
    // GIVEN
    app = new App();
    pipelineStack = new PipelineStack(app, 'PipelineStack', {
      dynamoDBTableArn: 'arn:aws:dynamodb:us-east-1:123456789012:table/movies-datastore', //Dummy ARN value for test
      openSearchIndexName: 'movies', //Dummy name for test
      openSearchDomainEndpoint: 'search-movies-search-xyzabcpqr.us-east-1.es.amazonaws.com', //Dummy endpoint for test
      pipelineRoleArn: 'arn:aws:iam::123456789012:role/OpenSearchIngestionRoleDynamoDB' //Dummy ARN value for test
    });
    // WHEN
    Aspects.of(pipelineStack).add(new AwsSolutionsChecks());
  });

  // THEN
  test('No unsuppressed Warnings', () => {
    const warnings = Annotations.fromStack(pipelineStack).findWarning(
      '*',
      Match.stringLikeRegexp('AwsSolutions-.*')
    );
    expect(warnings).toHaveLength(0);
  });

  test('No unsuppressed Errors', () => {
    const errors = Annotations.fromStack(pipelineStack).findError(
      '*',
      Match.stringLikeRegexp('AwsSolutions-.*')
    );
    expect(errors).toHaveLength(0);
  });
});
