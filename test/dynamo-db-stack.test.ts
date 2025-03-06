import { Annotations, Match } from 'aws-cdk-lib/assertions';
import { App, Aspects, Stack } from 'aws-cdk-lib';
import { AwsSolutionsChecks } from 'cdk-nag';
import { DynamoDBStack } from '../lib/dynamo-db-stack';

describe('cdk-nag AwsSolutions Pack', () => {
  let dynamoStack: DynamoDBStack;
  let app: App;
  // In this case we can use beforeAll() over beforeEach() since our tests 
  // do not modify the state of the application 
  beforeAll(() => {
    // GIVEN
    app = new App();
    dynamoStack = new DynamoDBStack(app, 'DynamoDBStack', {tableName: 'movies-datastore',
     primaryKey: 'title'});

    // WHEN
    Aspects.of(dynamoStack).add(new AwsSolutionsChecks());
  });

  // THEN
  test('No unsuppressed Warnings', () => {
    const warnings = Annotations.fromStack(dynamoStack).findWarning(
      '*',
      Match.stringLikeRegexp('AwsSolutions-.*')
    );
    expect(warnings).toHaveLength(0);
  });

  test('No unsuppressed Errors', () => {
    const errors = Annotations.fromStack(dynamoStack).findError(
      '*',
      Match.stringLikeRegexp('AwsSolutions-.*')
    );
    expect(errors).toHaveLength(0);
  });
});
