import * as s3 from "@aws-cdk/aws-s3";
import * as events from "@aws-cdk/aws-events";
import * as dynamodb from "@aws-cdk/aws-dynamodb";
import * as targets from "@aws-cdk/aws-events-targets";
import * as lambda from "@aws-cdk/aws-lambda";
import * as cdk from "@aws-cdk/core";
import * as iam from "@aws-cdk/aws-iam";
import * as sns from "@aws-cdk/aws-sns";
import * as sqs from "@aws-cdk/aws-sqs";
import * as subscriptions from "@aws-cdk/aws-sns-subscriptions";

import {
  DynamoEventSource,
  S3EventSource,
  // SqsEventSource,
  SnsEventSource
} from "@aws-cdk/aws-lambda-event-sources";

// // // //

export class LambdaCronStack extends cdk.Stack {
  constructor(app: cdk.App, id: string) {
    super(app, id);

    // // // //

    const myTopic = new sns.Topic(this, "MyTopic");
    const myQueue = new sqs.Queue(this, "MyQueue");

    // // // //
    // DUNNO IF THIS WORKS
    //**********IAM Roles******************************
    const textractServiceRole = new iam.Role(this, "TextractServiceRole", {
      assumedBy: new iam.ServicePrincipal("textract.amazonaws.com")
    });
    const policyStatement = new iam.PolicyStatement();
    // policyStatement.addActions("iam:PassRole");
    // policyStatement.addActions("sns:Publish");
    // policyStatement.addActions("textract:*");
    policyStatement.addActions("*");
    // policyStatement.addActions("textract:StartDocumentTextDetection");
    // policyStatement.addActions("textract:GetDocumentAnalysis");
    // policyStatement.addActions("textract:StartDocumentTextDetection");
    // policyStatement.addResources(myTopic.topicArn);
    policyStatement.addResources("*");
    // policyStatement.addResources(textractServiceRole.roleArn);
    // policyStatement.addServicePrincipal("ec2.amazonaws.com");
    textractServiceRole.addToPolicy(policyStatement);

    // Subscribes queue to topic
    myTopic.addSubscription(new subscriptions.SqsSubscription(myQueue));

    // // // //

    // Defines S3 bucket for downloaded PDFs
    // TODO - setup logging for S3 bucket
    // Doc: https://docs.aws.amazon.com/cdk/api/latest/docs/aws-s3-readme.html#logging-configuration
    const downloadsBucket: s3.Bucket = new s3.Bucket(
      this,
      "cogcc_pdf_downloads_bucket"
    );

    // // // //

    // Defines dynamoTable for PDF Download URLs
    const dynamoTable = new dynamodb.Table(this, "cogcc-pdf-urls", {
      partitionKey: {
        name: "itemId",
        type: dynamodb.AttributeType.STRING
      },
      stream: dynamodb.StreamViewType.NEW_IMAGE, // Configure streams
      tableName: "cogcc-pdf-urls",

      // The default removal policy is RETAIN, which means that cdk destroy will not attempt to delete
      // the new table, and it will remain in your account until manually deleted. By setting the policy to
      // DESTROY, cdk destroy will delete the table (even if it has data in it)
      removalPolicy: cdk.RemovalPolicy.DESTROY // NOT recommended for production code
    });

    // // // //

    // Defines DyanmoDB table for parsed PDF data
    const parsedPdfDataTable = new dynamodb.Table(this, "cogcc-pdf-data", {
      partitionKey: {
        name: "itemId",
        type: dynamodb.AttributeType.STRING
      },
      stream: dynamodb.StreamViewType.NEW_IMAGE, // Configure streams
      tableName: "cogcc-pdf-data",

      // The default removal policy is RETAIN, which means that cdk destroy will not attempt to delete
      // the new table, and it will remain in your account until manually deleted. By setting the policy to
      // DESTROY, cdk destroy will delete the table (even if it has data in it)
      removalPolicy: cdk.RemovalPolicy.DESTROY // NOT recommended for production code
    });

    // Lambda to download files and insert them into S3
    const sendPdfToTextractLambda = new lambda.Function(
      this,
      "sendPdfToTextractLambdaFunction",
      {
        code: new lambda.AssetCode("src"),
        handler: "send-pdf-to-textract.handler",
        runtime: lambda.Runtime.NODEJS_10_X,
        environment: {
          TABLE_NAME: parsedPdfDataTable.tableName,
          PRIMARY_KEY: "itemId",
          // SNS_TOPIC_ARN: jobCompletionTopic.topicArn,
          // ASYNC_QUEUE_URL: asyncJobsQueue.queueUrl,
          // SNS_ROLE_ARN: textractServiceRole.roleArn,
          S3_BUCKET_NAME: downloadsBucket.bucketName

          // request["qUrl"] = os.environ['ASYNC_QUEUE_URL']
          // request["snsRole"] = os.environ['SNS_ROLE_ARN']
        }
      }
    );

    // Adds permissions for the sendPdfToTextractLambdato read/write from parsedPdfDataTable + downloadsBucket
    parsedPdfDataTable.grantReadWriteData(sendPdfToTextractLambda);
    downloadsBucket.grantReadWrite(sendPdfToTextractLambda);

    // Configure event source so the `sendPdfToTextractLambda` is run each time a file is downloaded to S3
    // Doc: https://docs.aws.amazon.com/cdk/api/latest/docs/aws-lambda-event-sources-readme.html#s3
    // sendPdfToTextractLambda.addEventSource(
    //   new S3EventSource(downloadsBucket, {
    //     events: [s3.EventType.OBJECT_CREATED]
    //   })
    // );

    // // // //

    // addToQueue Lambda
    const addToQueue = new lambda.Function(this, "addToQueueLambdaFunction", {
      code: new lambda.AssetCode("src"),
      handler: "queueAdd.handler",
      runtime: lambda.Runtime.NODEJS_10_X,
      environment: {
        TABLE_NAME: parsedPdfDataTable.tableName,
        PRIMARY_KEY: "itemId",
        S3_BUCKET_NAME: downloadsBucket.bucketName,
        SNS_TOPIC_ARN: myTopic.topicArn,
        SNS_ROLE_ARN: textractServiceRole.roleArn,
        SQS_URL: myQueue.queueUrl
      }
    });

    // Configure event source so the `addToQueue` is run each time a file is downloaded to S3
    // Doc: https://docs.aws.amazon.com/cdk/api/latest/docs/aws-lambda-event-sources-readme.html#s3
    addToQueue.addEventSource(
      new S3EventSource(downloadsBucket, {
        events: [s3.EventType.OBJECT_CREATED]
      })
    );

    // Adds permissions for the addToQueue read/write from parsedPdfDataTable + downloadsBucket
    myQueue.grantSendMessages(addToQueue);
    myTopic.grantPublish(addToQueue);
    myTopic.grantPublish(textractServiceRole);
    parsedPdfDataTable.grantReadWriteData(addToQueue);
    downloadsBucket.grantReadWrite(addToQueue);

    // // // //

    // queueHandler Lambda
    const queueHandler = new lambda.Function(
      this,
      "queueHandlerLambdaFunction",
      {
        code: new lambda.AssetCode("src"),
        handler: "queueHandler.handler",
        runtime: lambda.Runtime.NODEJS_10_X,
        environment: {
          TABLE_NAME: parsedPdfDataTable.tableName,
          PRIMARY_KEY: "itemId",
          SNS_TOPIC_ARN: myTopic.topicArn,
          SNS_ROLE_ARN: textractServiceRole.roleArn,
          S3_BUCKET_NAME: downloadsBucket.bucketName,
          SQS_URL: myQueue.queueUrl
        }
      }
    );

    // Feeds queue into function every 2 minutes
    const asyncQueueCronRule = new events.Rule(this, "AsyncQueueRule", {
      schedule: events.Schedule.expression("rate(2 minutes)")
    });

    // Adds queueHandler as target for queue cron rule
    asyncQueueCronRule.addTarget(new targets.LambdaFunction(queueHandler));

    // Adds permissions for the queueHandler read/write from parsedPdfDataTable + downloadsBucket
    parsedPdfDataTable.grantReadWriteData(queueHandler);
    downloadsBucket.grantReadWrite(queueHandler);
    myQueue.grantConsumeMessages(queueHandler);

    // // // //

    // queueResult Lambda
    const queueResult = new lambda.Function(this, "queueResultLambdaFunction", {
      code: new lambda.AssetCode("src"),
      handler: "queueResult.handler",
      runtime: lambda.Runtime.NODEJS_10_X,
      timeout: cdk.Duration.seconds(300),
      memorySize: 1024,
      environment: {
        TABLE_NAME: parsedPdfDataTable.tableName,
        PRIMARY_KEY: "itemId",
        SNS_TOPIC_ARN: myTopic.topicArn,
        SNS_ROLE_ARN: textractServiceRole.roleArn,
        S3_BUCKET_NAME: downloadsBucket.bucketName
      }
    });

    // Adds permissions for the queueResult read/write from parsedPdfDataTable + downloadsBucket
    parsedPdfDataTable.grantReadWriteData(queueResult);
    downloadsBucket.grantReadWrite(queueResult);
    myQueue.grantConsumeMessages(queueResult);

    // TODO - try this too...
    queueResult.addEventSource(new SnsEventSource(myTopic));
    queueResult.addToRolePolicy(policyStatement);
    // queueResult.addEventSource(
    //   new SqsEventSource(myQueue, {
    //     batchSize: 1
    //   })
    // );

    // // // //

    // Lambda to download files and insert them into S3
    const fileDownloaderLambda = new lambda.Function(
      this,
      "fileDownloaderLambdaFunction",
      {
        code: new lambda.AssetCode("src"),
        handler: "download-file.handler",
        runtime: lambda.Runtime.NODEJS_10_X,
        environment: {
          TABLE_NAME: dynamoTable.tableName,
          S3_BUCKET_NAME: downloadsBucket.bucketName,
          PRIMARY_KEY: "itemId"
        }
      }
    );

    // Adds permissions for the lambdaFn to read/write from dynamoTable + downloadsBucket
    dynamoTable.grantReadWriteData(fileDownloaderLambda);
    downloadsBucket.grantReadWrite(fileDownloaderLambda);

    // Add DynamoDB stream event source to fileDownloaderLambda
    // Invoked once-per-document
    fileDownloaderLambda.addEventSource(
      new DynamoEventSource(dynamoTable, {
        startingPosition: lambda.StartingPosition.TRIM_HORIZON,
        batchSize: 1
      })
    );

    // // // //

    // DownloadURL Crawler Lambda
    const lambdaFn = new lambda.Function(this, "fetchPdfDownloadUrlsFunction", {
      code: new lambda.AssetCode("src"),
      handler: "fetch-pdfs.handler",
      runtime: lambda.Runtime.NODEJS_10_X,
      timeout: cdk.Duration.seconds(300),
      memorySize: 1024,
      environment: {
        TABLE_NAME: dynamoTable.tableName,
        PRIMARY_KEY: "itemId"
      }
    });

    // Adds permissions for the lambdaFn to read/write from dynamoTable
    dynamoTable.grantReadWriteData(lambdaFn);

    // // // //

    // Run every day at 6PM UTC
    // See https://docs.aws.amazon.com/lambda/latest/dg/tutorial-scheduled-events-schedule-expressions.html
    const rule = new events.Rule(this, "Rule", {
      // schedule: events.Schedule.expression("cron(0 18 ? * MON-FRI *)")
      schedule: events.Schedule.expression("rate(2 minutes)")
    });

    rule.addTarget(new targets.LambdaFunction(lambdaFn));
  }
}

const app = new cdk.App();
new LambdaCronStack(app, "LambdaCronExample");
app.synth();
