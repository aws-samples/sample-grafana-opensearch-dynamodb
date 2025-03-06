# Amazon DynamoDB zero-ETL integration with Amazon OpenSearch Service using CDK

A fully automated AWS infrastructure setup for enabling Zero-ETL integration between Amazon DynamoDB and Amazon OpenSearch Service. This setup enables ingesting, storing, and searching data using DynamoDB and OpenSearch. The pipeline enables efficient data storage with real-time synchronization to a searchable OpenSearch index.

This project implements a serverless data pipeline that stores movie data in DynamoDB and automatically syncs it to OpenSearch using the OpenSearch ingestion pipeline that uses the Zero-ETL blueprint for advanced search capabilities. Built with AWS CDK, it provides infrastructure-as-code deployment of all necessary AWS resources with security best practices and monitoring capabilities built-in. The pipeline supports real-time data ingestion through DynamoDB Streams and includes a Python utility for initial data loading.

## Data Flow
The pipeline implements a real-time data synchronization between DynamoDB and OpenSearch using DynamoDB Streams.

```ascii
[DynamoDB Table] --> [DynamoDB Stream] --> [OpenSearch Ingestion Pipeline] --> [OpenSearch Domain]
     ^
     |
[Upload Script]
```

Key component interactions:
1. Data is written to DynamoDB table through the UploadData.py script or application
2. DynamoDB Streams captures all changes in real-time
3. OpenSearch Ingestion Pipeline monitors the stream for changes
4. Pipeline transforms and loads data into OpenSearch
5. Data becomes searchable in OpenSearch with minimal latency
6. KMS encryption protects data at rest
7. IAM roles control access between components
8. CloudWatch logs capture pipeline operations

## Infrastructure

```ascii
                                                     ┌──────────────────┐
                                                     │   CloudWatch     │
                                                     │      Logs        │
                                                     └────────┬─────────┘
                                                              │
┌────────────────┐    ┌─────────────┐    ┌──────────────────┐ │  ┌──────────────┐
│   DynamoDB     │    │  DynamoDB   │    │    OpenSearch    │ ▼  │  OpenSearch  │
│    Table       ├───►│   Streams   ├───►│    Ingestion     │───►│   Domain     │
│movies-datastore│    │             │    │    Pipeline      │    │movies-search │
└────────────────┘    └─────────────┘    └─────────┬────────┘    └──────┬───────┘
        ▲                                          │                    │
        │                                          │                    │
        │                                          ▼                    ▼
┌──────────────┐                           ┌──────────────┐     ┌──────────────┐
│  Upload.py   │                           │     IAM      │     │     KMS      │
│   Script     │                           │    Roles     │     │     Key      │
└──────────────┘                           └──────────────┘     └──────────────┘

```

## Repository Structure
```
.
├── bin/
│   └── cdk.ts                 # CDK app entry point defining stack configuration
├── lib/
│   ├── dynamo-db-stack.ts     # DynamoDB table infrastructure definition
│   ├── opensearch-stack.ts    # OpenSearch domain and security configuration
│   └── pipeline-stack.ts      # Data pipeline infrastructure between DynamoDB and OpenSearch
├── data-load/
│   ├── moviedata_subset.json  # Sample movie data for initial load
│   └── UploadData.py         # Python script for loading data into DynamoDB
├── test/                     # Unit tests for infrastructure stacks
└── [Configuration files]     # TypeScript, CDK, and project configuration files
```

## Usage Instructions
### Prerequisites
- Node.js (v14 or later)
- Python 3.x
- AWS CDK CLI (`npm install -g aws-cdk`)
- AWS account
- IAM role with required permissions to perform CRUDL operations on all the resources mentioned in the Infrastructure section above 
- AWS CLI configured with appropriate credentials
- boto3 Python library (`pip install boto3`)

### Getting Started
1. Setup the project:
```bash
# Clone the repository
git clone <repository-url>
cd <repository-name>

# Install dependencies
npm install

# Bootstrap CDK (first-time only)
cdk bootstrap
```
2. Deploy the infrastructure:

```bash
# Deploy the stacks one by one
cdk deploy DynamoDBStack
cdk deploy OpensearchStack
cdk deploy PipelineStack

# OR deploy all the stacks at once
cdk deploy --all
```

3. Load initial movie data:
```bash
cd data-load
python UploadData.py
```

4. Verify the pipeline:
```bash
# Check CloudWatch logs
aws logs get-log-events --log-group-name /aws/vendedlogs/OpenSearchIngestion/dynamodb-OSS-movies-pipeline
```
### Resource Configurations 
#### DynamoDB
- Table: movies-datastore
  - Partition Key: title (String)
  - Billing Mode: PAY_PER_REQUEST
  - Stream: NEW_AND_OLD_IMAGES
  - Point-in-Time Recovery: Enabled

#### OpenSearch
- Domain: movies-search
  - Engine Version: OpenSearch 2.11
  - Instance Type: r7g.medium.search
  - Node Count: 2
  - Storage: 10GB GP3 EBS
  - Security: Node-to-node encryption, HTTPS enforcement, Fine-grained access control
  - Monitoring: Slow search, application, and indexing logs enabled

#### IAM
- Role: OpenSearchIngestionRoleDynamoDB
  - Managed Policy: AmazonOpenSearchIngestionReadOnlyAccess
  - Custom policies for DynamoDB and OpenSearch access

#### KMS
- Key: OpenSearchKMSKey
  - Usage: OpenSearch encryption
  - Rotation: Enabled
  - Custom key policy for OpenSearch service

### Troubleshooting
1. DynamoDB Stream Issues
- Problem: Data not appearing in OpenSearch
- Solution:
  ```bash
  # Check DynamoDB streams
  aws dynamodb describe-table --table-name movies-datastore --query 'Table.StreamSpecification'
  
  # Verify pipeline logs
  aws logs tail /aws/vendedlogs/OpenSearchIngestion/dynamodb-OSS-movies-pipeline
  ```

2. OpenSearch Access Issues
- Problem: Authentication failures
- Solution:
  ```bash
  # Verify IAM role
  aws iam get-role --role-name OpenSearchIngestionRoleDynamoDB
  
  # Check policy attachments
  aws iam list-role-policies --role-name OpenSearchIngestionRoleDynamoDB
  ```

## Security

See [CONTRIBUTING](CONTRIBUTING.md#security-issue-notifications) for more information.

## License

This library is licensed under the MIT-0 License. See the LICENSE file.

