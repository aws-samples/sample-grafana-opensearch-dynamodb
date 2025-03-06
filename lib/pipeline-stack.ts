import * as cdk from 'aws-cdk-lib';
import * as opensearch from 'aws-cdk-lib/aws-opensearchservice';
import * as osis from 'aws-cdk-lib/aws-osis';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';

export interface PipelineStackProps extends cdk.StackProps {
  dynamoDBTableArn: string;
  openSearchIndexName: string;
  openSearchDomainEndpoint: string;
  pipelineRoleArn: string;
}

export class PipelineStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: PipelineStackProps) {
    super(scope, id, props);

    // Create CloudWatch Log Group
    const logGroup = new logs.LogGroup(this, 'OpenSearchIngestionLogGroup', {
      logGroupName: '/aws/vendedlogs/OpenSearchIngestion/dynamodb-OSS-movies-pipeline',
      retention: logs.RetentionDays.ONE_DAY,
      removalPolicy: cdk.RemovalPolicy.DESTROY
    });

    // Create Ingestion Pipeline
    const pipelineConfigurationBody = this.toYamlString({
      version: '2',
      'dynamodb-oss-pipeline': {
        source: {
          dynamodb: {
            acknowledgments: true,
            tables: [
              {
                table_arn: props.dynamoDBTableArn,
                stream: {
                  start_position: "LATEST",
                }
              }
            ],
            aws: {
              sts_role_arn: props.pipelineRoleArn,
              region: this.region
            },
          },
        },
        sink: [
          {
            opensearch: {
              hosts: [ `https://${props.openSearchDomainEndpoint}`],
              index: props.openSearchIndexName,
              index_type: "custom",
              document_id: "${/title}",
              action: "${getMetadata(\"opensearch_action\")}",
              document_version: "${getMetadata(\"document_version\")}",
              document_version_type: "external",
              flush_timeout: -1,
              aws: {
                sts_role_arn: props.pipelineRoleArn,
                region: this.region,
                serverless: false
              },
            },
        }],
      },
    });

    const pipeline = new osis.CfnPipeline(this, 'IngestPipeline', {
      pipelineName: 'dynamodb-pipeline',
      minUnits: 1,
      maxUnits: 4,
      pipelineConfigurationBody: pipelineConfigurationBody,
      logPublishingOptions: {
        cloudWatchLogDestination: {
          logGroup: logGroup.logGroupName,
        },
        isLoggingEnabled: true,
      },
    });

    // Outputs
    new cdk.CfnOutput(this, 'LogGroupName', {
      value: logGroup.logGroupName,
      description: 'Name of the CloudWatch Log Group for OpenSearch Ingestion',
    });

    new cdk.CfnOutput(this, 'OSPipelineName', {
      value: pipeline.pipelineName,
      description: 'Name of the OpenSearch Ingestion pipeline',
    });
  }
}