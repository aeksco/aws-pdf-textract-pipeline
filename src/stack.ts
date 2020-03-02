import * as s3 from "@aws-cdk/aws-s3";
import * as events from "@aws-cdk/aws-events";
import * as dynamodb from "@aws-cdk/aws-dynamodb";
import * as targets from "@aws-cdk/aws-events-targets";
import * as lambda from "@aws-cdk/aws-lambda";
import * as cdk from "@aws-cdk/core";
import * as iam from "@aws-cdk/aws-iam";
import * as sns from "@aws-cdk/aws-sns";
import {
  DynamoEventSource,
  S3EventSource,
  SnsEventSource
} from "@aws-cdk/aws-lambda-event-sources";

// // // //

export class PdfTextractPipeline extends cdk.Stack {
  // constructor(app: cdk.App, id: string) {
  constructor(scope: cdk.Construct, id: string) {
    super(scope, id);

    // Provisions SNS topic for Textract asynchronous AnalyzeDocument process
    const snsTopic = new sns.Topic(this, "TextractTopic");

    // Provisions IAM Role for Textract Service
    const textractServiceRole = new iam.Role(this, "TextractServiceRole", {
      assumedBy: new iam.ServicePrincipal("textract.amazonaws.com")
    });

    // Provisions PolicyStatement for textractServiceRole
    // NOTE - addActions and addResources should have more fine-grained policy settings
    const policyStatement = new iam.PolicyStatement();
    policyStatement.addActions("*");
    policyStatement.addResources("*");
    textractServiceRole.addToPolicy(policyStatement);

    // Grant the textractServiceRole the ability to publish to snsTopic
    snsTopic.grantPublish(textractServiceRole);

    // Provisions S3 bucket for downloaded PDFs
    // Doc: https://docs.aws.amazon.com/cdk/api/latest/docs/aws-s3-readme.html#logging-configuration
    const downloadsBucket: s3.Bucket = new s3.Bucket(
      this,
      "cogcc_pdf_downloads_bucket"
    );

    // // // //
    // Provisions DynamoDB tables
    // The default removal policy is RETAIN, which means that cdk destroy will not attempt to delete
    // the new table, and it will remain in your account until manually deleted. By setting the policy to
    // DESTROY, cdk destroy will delete the table (even if it has data in it)

    // Defines pdfUrlsTable for PDF Download URLs
    const pdfUrlsTable = new dynamodb.Table(this, "cogcc-pdf-urls", {
      partitionKey: {
        name: "itemId",
        type: dynamodb.AttributeType.STRING
      },
      stream: dynamodb.StreamViewType.NEW_IMAGE,
      tableName: "cogcc-pdf-urls",
      removalPolicy: cdk.RemovalPolicy.DESTROY // NOTE - This removalPolicy is NOT recommended for production code
    });

    // Defines DyanmoDB table for parsed PDF data
    const parsedPdfDataTable = new dynamodb.Table(this, "cogcc-pdf-data", {
      partitionKey: {
        name: "itemId",
        type: dynamodb.AttributeType.STRING
      },
      stream: dynamodb.StreamViewType.NEW_IMAGE,
      tableName: "cogcc-pdf-data",
      removalPolicy: cdk.RemovalPolicy.DESTROY // NOTE - This removalPolicy is NOT recommended for production code
    });

    // // // //
    // Provisions send-pdf-to-textract lambda

    // sendPdfToTextract Lambda
    const sendPdfToTextract = new lambda.Function(
      this,
      "sendPdfToTextractFunction",
      {
        code: new lambda.AssetCode("src/send-pdf-to-textract"),
        handler: "lambda.handler",
        runtime: lambda.Runtime.NODEJS_10_X,
        environment: {
          TABLE_NAME: parsedPdfDataTable.tableName,
          PRIMARY_KEY: "itemId",
          S3_BUCKET_NAME: downloadsBucket.bucketName,
          SNS_TOPIC_ARN: snsTopic.topicArn,
          SNS_ROLE_ARN: textractServiceRole.roleArn
        }
      }
    );

    // Configure event source so the `sendPdfToTextract` is run each time a file is downloaded to S3
    // Doc: https://docs.aws.amazon.com/cdk/api/latest/docs/aws-lambda-event-sources-readme.html#s3
    sendPdfToTextract.addEventSource(
      new S3EventSource(downloadsBucket, {
        events: [s3.EventType.OBJECT_CREATED]
      })
    );

    // Add "textract:*" actions to sendPdfToTextract lambda
    sendPdfToTextract.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["textract:*"],
        resources: ["*"]
      })
    );

    // Adds permissions for the sendPdfToTextract read/write from parsedPdfDataTable + downloadsBucket
    snsTopic.grantPublish(sendPdfToTextract);
    parsedPdfDataTable.grantReadWriteData(sendPdfToTextract);
    downloadsBucket.grantReadWrite(sendPdfToTextract);

    // // // //
    // Provisions send-textract-result-to-dynamo lambda

    // sendTextractResultToDynamo Lambda
    const sendTextractResultToDynamo = new lambda.Function(
      this,
      "sendTextractResultToDynamo",
      {
        code: new lambda.AssetCode("src/send-textract-result-to-dynamo"),
        handler: "lambda.handler",
        runtime: lambda.Runtime.NODEJS_10_X,
        timeout: cdk.Duration.seconds(300),
        environment: {
          TABLE_NAME: parsedPdfDataTable.tableName,
          PRIMARY_KEY: "itemId",
          SNS_TOPIC_ARN: snsTopic.topicArn,
          SNS_ROLE_ARN: textractServiceRole.roleArn,
          S3_BUCKET_NAME: downloadsBucket.bucketName
        }
      }
    );

    // Adds permissions for the sendTextractResultToDynamo read/write from parsedPdfDataTable + downloadsBucket
    parsedPdfDataTable.grantReadWriteData(sendTextractResultToDynamo);
    downloadsBucket.grantReadWrite(sendTextractResultToDynamo);
    sendTextractResultToDynamo.addEventSource(new SnsEventSource(snsTopic));
    sendTextractResultToDynamo.addToRolePolicy(policyStatement);

    // // // //
    // Provisions download-pdf-to-s3 lambda

    // Lambda to download files and insert them into S3
    const downloadPdfToS3Lambda = new lambda.Function(
      this,
      "downloadPdfToS3Lambda",
      {
        code: new lambda.AssetCode("src/download-pdf-to-s3"),
        handler: "lambda.handler",
        runtime: lambda.Runtime.NODEJS_10_X,
        environment: {
          TABLE_NAME: pdfUrlsTable.tableName,
          S3_BUCKET_NAME: downloadsBucket.bucketName,
          PRIMARY_KEY: "itemId"
        }
      }
    );

    // Adds permissions for the lambdaFn to read/write from pdfUrlsTable + downloadsBucket
    pdfUrlsTable.grantReadWriteData(downloadPdfToS3Lambda);
    downloadsBucket.grantReadWrite(downloadPdfToS3Lambda);

    // Add DynamoDB stream event source to downloadPdfToS3Lambda
    // Invoked once-per-document
    downloadPdfToS3Lambda.addEventSource(
      new DynamoEventSource(pdfUrlsTable, {
        startingPosition: lambda.StartingPosition.TRIM_HORIZON,
        batchSize: 1
      })
    );

    // // // //
    // Provisions scrape-pdfs-from-website lambda
    // NOTE - we bump the memory to 1024mb here to accommodate the memory requirements for Puppeteer

    // DownloadURL Crawler Lambda
    const scrapePdfsFromWebsiteLambda = new lambda.Function(
      this,
      "scrapePdfsFromWebsiteLambda",
      {
        code: new lambda.AssetCode("src/scrape-pdfs-from-website"),
        handler: "lambda.handler",
        runtime: lambda.Runtime.NODEJS_10_X,
        timeout: cdk.Duration.seconds(300),
        memorySize: 1024,
        environment: {
          TABLE_NAME: pdfUrlsTable.tableName,
          PRIMARY_KEY: "itemId"
        }
      }
    );

    // Adds permissions for the scrapePdfsFromWebsiteLambda to read/write from pdfUrlsTable
    pdfUrlsTable.grantReadWriteData(scrapePdfsFromWebsiteLambda);

    // Run `scrape-pdfs-from-website` every 12 hours
    // See https://docs.aws.amazon.com/lambda/latest/dg/tutorial-scheduled-events-schedule-expressions.html
    const rule = new events.Rule(this, "Rule", {
      schedule: events.Schedule.expression("rate(720 minutes)")
    });

    // Adds scrapePdfsFromWebsiteLambda as target for scheduled rule
    rule.addTarget(new targets.LambdaFunction(scrapePdfsFromWebsiteLambda));
  }
}
