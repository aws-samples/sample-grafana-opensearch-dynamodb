import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';


interface DynamoStackProps extends cdk.StackProps {
  tableName: string;
  primaryKey: string;
}

export class DynamoDBStack extends cdk.Stack {
  public readonly dynamodbTable: dynamodb.Table

  constructor(scope: Construct, id: string, props: DynamoStackProps) {
    super(scope, id, props);

    const dynamodbTable = new dynamodb.Table(this, 'DynamoDBTable', {
      tableName: props.tableName,
      partitionKey: {name: props.primaryKey, type: dynamodb.AttributeType.STRING},
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES, // Enable DynamoDB Streams
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      pointInTimeRecovery: true
    });

    this.dynamodbTable = dynamodbTable;
  }
}
