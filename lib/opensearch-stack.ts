import * as cdk from 'aws-cdk-lib';
import * as opensearch from 'aws-cdk-lib/aws-opensearchservice';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';

export interface OpenSearchStackProps extends cdk.StackProps {
  dynamoDBTableArn: string;
  openSearchDomainName: string;
  openSearchIndexName: string;
}

export class OpenSearchStack extends cdk.Stack {
  public readonly openSearchDomain: opensearch.Domain;
  public readonly pipelineRole: iam.Role;
  constructor(scope: Construct, id: string, props: OpenSearchStackProps) {
    super(scope, id, props);

    // Create KMS Key
    const kmsKey = new kms.Key(this, 'OpenSearchKMSKey', {
      description: 'Default key that protects my Amazon OpenSearch Service',
      enableKeyRotation: true,
      policy: new iam.PolicyDocument({
        statements: [
          new iam.PolicyStatement({
            sid: 'Allow direct access to key metadata to the account root',
            effect: iam.Effect.ALLOW,
            principals: [new iam.AccountRootPrincipal()],
            actions: ['kms:*'],
            resources: ['*'],
          }),
          new iam.PolicyStatement({
            sid: 'Allow access through OpenSearch Service for all principals in the account that are authorized to use OpenSearch Service',
            effect: iam.Effect.ALLOW,
            principals: [new iam.AnyPrincipal()],
            actions: [
              'kms:Encrypt',
              'kms:Decrypt',
              'kms:ReEncrypt*',
              'kms:GenerateDataKey*',
              'kms:CreateGrant',
              'kms:DescribeKey'
            ],
            resources: ['*'],
            conditions: {
              StringEquals: {
                'kms:ViaService': `es.${this.region}.amazonaws.com`,
                'kms:CallerAccount': this.account
              }
            }
          }),
          new iam.PolicyStatement({
            sid: 'Allow OpenSearch service principals to describe the key directly',
            effect: iam.Effect.ALLOW,
            principals: [new iam.ServicePrincipal('es.amazonaws.com')],
            actions: [
              'kms:Describe*',
              'kms:Get*',
              'kms:List*'
            ],
            resources: ['*'],
          }),
        ],
      }),
    });

    // Create IAM Role
    const pipelineRole = new iam.Role(this, 'IAMRoleOSIngestionDynamo', {
      assumedBy: new iam.ServicePrincipal('osis-pipelines.amazonaws.com'),
      description: 'IAM role for OpenSearch Ingestion pipeline',
      managedPolicies: [iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonOpenSearchIngestionReadOnlyAccess')],
      roleName: 'OpenSearchIngestionRoleDynamoDB',
      inlinePolicies: {
        'OpenSearchIngestionPolicy': new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'dynamodb:DescribeTable',
                'dynamodb:DescribeStream',
                'dynamodb:Scan',
                'dynamodb:Query',
                'dynamodb:GetItem',
                'dynamodb:GetRecords',
                'dynamodb:GetShardIterator',
              ],
              resources: [
                props.dynamoDBTableArn,
                `${props.dynamoDBTableArn}/stream/*`,
              ],
            }),
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'dynamodb:ListTables',
                'dynamodb:ListStreams',
              ],
              resources: ['*'],
            }),
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                "es:ESHttpGet",
                "es:ESHttpPut",
                "es:ESHttpPost",
                "es:DescribeDomain"
                // "es:Describe*",
                // "es:List*",
                // "es:Get*",
                // "es:ESHttp*",
                // "es:Update*"
              ],
              resources: [
                `arn:aws:es:${this.region}:${this.account}:domain/${props.openSearchDomainName}`,
                `arn:aws:es:${this.region}:${this.account}:domain/${props.openSearchDomainName}/*`,
              ],
            }),
          ],
        }),
      },
    });

    this.pipelineRole = pipelineRole;

    // Create a secret for the master user credentials
    const masterUserSecret = new secretsmanager.Secret(this, 'OpenSearchMasterUser', {
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ username: 'admin' }),
        generateStringKey: 'password',
        passwordLength: 16,
        requireEachIncludedType: true,
        excludeLowercase: false,
        excludeUppercase: false,
        excludeNumbers: false,
        excludePunctuation: false,
        includeSpace: false,
        excludeCharacters: '\'"`\\',
      },
      description: 'Movie search OpenSearch domain master user credentials',
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
      
    // Create OpenSearch Domain
    //const existingDomain = opensearch.Domain.fromDomainEndpoint(this, 'ExistingDomain', 'https://search-movies-search-cyhyklhvpjvjcon5bafe4v5m2q.us-east-1.es.amazonaws.com');
    const openSearchDomain = new opensearch.Domain(this, 'OpenSearchDomain', {
      domainName: props.openSearchDomainName,
      version: opensearch.EngineVersion.OPENSEARCH_2_11,
      capacity: {
        multiAzWithStandbyEnabled: false,
        dataNodes: 2,
        dataNodeInstanceType: 'r7g.medium.search',
      },
      zoneAwareness: {
        availabilityZoneCount: 2,
        
      },
      ebs: {
        enabled: true,
        volumeType: cdk.aws_ec2.EbsDeviceVolumeType.GP3,
        volumeSize: 10,
      },
      nodeToNodeEncryption: true,
      encryptionAtRest: {
        enabled: true,
        kmsKey: kmsKey,
      },
      enforceHttps: true,
      tlsSecurityPolicy: opensearch.TLSSecurityPolicy.TLS_1_2,
      fineGrainedAccessControl: {
        // masterUserArn: pipelineRole.roleArn
        masterUserName: masterUserSecret.secretValueFromJson('username').unsafeUnwrap(),
        masterUserPassword: masterUserSecret.secretValueFromJson('password'),
      },
      advancedOptions: {
        'indices.fielddata.cache.size': '20',
        'indices.query.bool.max_clause_count': '1024',
        'override_main_response_version': 'false',
        'rest.action.multi.allow_explicit_index': 'true',
      },
      logging: {
        slowSearchLogEnabled: true,
        appLogEnabled: true,
        slowIndexLogEnabled: true,
      },
      useUnsignedBasicAuth: false,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      accessPolicies: [new iam.PolicyStatement({
        actions: ['es:*'],
        effect: iam.Effect.ALLOW,
        principals: [new iam.AnyPrincipal()],
        resources: [this.formatArn({
          service: 'es',
          resource: 'domain',
          resourceName: `${props.openSearchDomainName}/*`,
        })],
      })],
    });
    this.openSearchDomain = openSearchDomain;
    
    // Add additional configurations
    const cfnDomain = openSearchDomain.node.defaultChild as opensearch.CfnDomain;
    cfnDomain.addPropertyOverride('IPAddressType', 'dualstack');
    cfnDomain.addPropertyOverride('OffPeakWindowOptions', {
      Enabled: true,
      OffPeakWindow: {
        WindowStartTime: {
          Hours: 0,
          Minutes: 0,
        },
      },
    });
    cfnDomain.addPropertyOverride('SoftwareUpdateOptions', {
      AutoSoftwareUpdateEnabled: true,
    });
    
    openSearchDomain.grantIndexReadWrite('*', pipelineRole);
    openSearchDomain.grantReadWrite(pipelineRole);

    // Output
    new cdk.CfnOutput(this, 'OpenSearchDomainEndpoint', {
      value: openSearchDomain.domainEndpoint,
      description: 'Endpoint for the OpenSearch domain',
    });
    
    new cdk.CfnOutput(this, 'OpenSearchDomainArn', {
      value: openSearchDomain.domainArn,
      description: 'ARN of the OpenSearch domain',
    });

    new cdk.CfnOutput(this, 'OpenSearchKMSKeyArn', {
      value: kmsKey.keyArn,
      description: 'ARN of the KMS key used for OpenSearch encryption',
    });

    new cdk.CfnOutput(this, 'OpenSearchIAMRoleArn', {
      value: pipelineRole.roleArn,
      description: 'ARN of the IAM role for OpenSearch',
    });

  }
}