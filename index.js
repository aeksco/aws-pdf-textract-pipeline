"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const s3 = require("@aws-cdk/aws-s3");
const events = require("@aws-cdk/aws-events");
const dynamodb = require("@aws-cdk/aws-dynamodb");
const targets = require("@aws-cdk/aws-events-targets");
const lambda = require("@aws-cdk/aws-lambda");
const cdk = require("@aws-cdk/core");
const iam = require("@aws-cdk/aws-iam");
const sns = require("@aws-cdk/aws-sns");
const sqs = require("@aws-cdk/aws-sqs");
const subscriptions = require("@aws-cdk/aws-sns-subscriptions");
const aws_lambda_event_sources_1 = require("@aws-cdk/aws-lambda-event-sources");
// // // //
class LambdaCronStack extends cdk.Stack {
    constructor(app, id) {
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
        const downloadsBucket = new s3.Bucket(this, "cogcc_pdf_downloads_bucket");
        // // // //
        // Defines dynamoTable for PDF Download URLs
        const dynamoTable = new dynamodb.Table(this, "cogcc-pdf-urls", {
            partitionKey: {
                name: "itemId",
                type: dynamodb.AttributeType.STRING
            },
            stream: dynamodb.StreamViewType.NEW_IMAGE,
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
            stream: dynamodb.StreamViewType.NEW_IMAGE,
            tableName: "cogcc-pdf-data",
            // The default removal policy is RETAIN, which means that cdk destroy will not attempt to delete
            // the new table, and it will remain in your account until manually deleted. By setting the policy to
            // DESTROY, cdk destroy will delete the table (even if it has data in it)
            removalPolicy: cdk.RemovalPolicy.DESTROY // NOT recommended for production code
        });
        // Lambda to download files and insert them into S3
        const sendPdfToTextractLambda = new lambda.Function(this, "sendPdfToTextractLambdaFunction", {
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
        });
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
        addToQueue.addEventSource(new aws_lambda_event_sources_1.S3EventSource(downloadsBucket, {
            events: [s3.EventType.OBJECT_CREATED]
        }));
        // Adds permissions for the addToQueue read/write from parsedPdfDataTable + downloadsBucket
        myQueue.grantSendMessages(addToQueue);
        myTopic.grantPublish(addToQueue);
        myTopic.grantPublish(textractServiceRole);
        parsedPdfDataTable.grantReadWriteData(addToQueue);
        downloadsBucket.grantReadWrite(addToQueue);
        // // // //
        // queueHandler Lambda
        const queueHandler = new lambda.Function(this, "queueHandlerLambdaFunction", {
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
        });
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
        queueResult.addEventSource(new aws_lambda_event_sources_1.SnsEventSource(myTopic));
        queueResult.addToRolePolicy(policyStatement);
        // queueResult.addEventSource(
        //   new SqsEventSource(myQueue, {
        //     batchSize: 1
        //   })
        // );
        // // // //
        // Lambda to download files and insert them into S3
        const fileDownloaderLambda = new lambda.Function(this, "fileDownloaderLambdaFunction", {
            code: new lambda.AssetCode("src"),
            handler: "download-file.handler",
            runtime: lambda.Runtime.NODEJS_10_X,
            environment: {
                TABLE_NAME: dynamoTable.tableName,
                S3_BUCKET_NAME: downloadsBucket.bucketName,
                PRIMARY_KEY: "itemId"
            }
        });
        // Adds permissions for the lambdaFn to read/write from dynamoTable + downloadsBucket
        dynamoTable.grantReadWriteData(fileDownloaderLambda);
        downloadsBucket.grantReadWrite(fileDownloaderLambda);
        // Add DynamoDB stream event source to fileDownloaderLambda
        // Invoked once-per-document
        fileDownloaderLambda.addEventSource(new aws_lambda_event_sources_1.DynamoEventSource(dynamoTable, {
            startingPosition: lambda.StartingPosition.TRIM_HORIZON,
            batchSize: 1
        }));
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
exports.LambdaCronStack = LambdaCronStack;
const app = new cdk.App();
new LambdaCronStack(app, "LambdaCronExample");
app.synth();
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJpbmRleC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQUFBLHNDQUFzQztBQUN0Qyw4Q0FBOEM7QUFDOUMsa0RBQWtEO0FBQ2xELHVEQUF1RDtBQUN2RCw4Q0FBOEM7QUFDOUMscUNBQXFDO0FBQ3JDLHdDQUF3QztBQUN4Qyx3Q0FBd0M7QUFDeEMsd0NBQXdDO0FBQ3hDLGdFQUFnRTtBQUVoRSxnRkFLMkM7QUFFM0MsV0FBVztBQUVYLE1BQWEsZUFBZ0IsU0FBUSxHQUFHLENBQUMsS0FBSztJQUM1QyxZQUFZLEdBQVksRUFBRSxFQUFVO1FBQ2xDLEtBQUssQ0FBQyxHQUFHLEVBQUUsRUFBRSxDQUFDLENBQUM7UUFFZixXQUFXO1FBRVgsTUFBTSxPQUFPLEdBQUcsSUFBSSxHQUFHLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxTQUFTLENBQUMsQ0FBQztRQUMvQyxNQUFNLE9BQU8sR0FBRyxJQUFJLEdBQUcsQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUFFLFNBQVMsQ0FBQyxDQUFDO1FBRS9DLFdBQVc7UUFDWCxzQkFBc0I7UUFDdEIsbURBQW1EO1FBQ25ELE1BQU0sbUJBQW1CLEdBQUcsSUFBSSxHQUFHLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxxQkFBcUIsRUFBRTtZQUNwRSxTQUFTLEVBQUUsSUFBSSxHQUFHLENBQUMsZ0JBQWdCLENBQUMsd0JBQXdCLENBQUM7U0FDOUQsQ0FBQyxDQUFDO1FBQ0gsTUFBTSxlQUFlLEdBQUcsSUFBSSxHQUFHLENBQUMsZUFBZSxFQUFFLENBQUM7UUFDbEQsOENBQThDO1FBQzlDLDZDQUE2QztRQUM3Qyw0Q0FBNEM7UUFDNUMsZUFBZSxDQUFDLFVBQVUsQ0FBQyxHQUFHLENBQUMsQ0FBQztRQUNoQyxxRUFBcUU7UUFDckUsOERBQThEO1FBQzlELHFFQUFxRTtRQUNyRSxrREFBa0Q7UUFDbEQsZUFBZSxDQUFDLFlBQVksQ0FBQyxHQUFHLENBQUMsQ0FB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QzdCLE1BQU0sUUFBUSxHQUFHLElBQUksTUFBTSxDQUFDLFFBQVEsQ0FBQyxJQUFJLEVBQUUsOEJBQThCLEVBQUU7WUFDekUsSUFBSSxFQUFFLElBQUksTUFBTSxDQUFDLFNBQVMsQ0FBQyxLQUFLLENBQUM7WUFDakMsT0FBTyxFQUFFLG9CQUFvQjtZQUM3QixPQUFPLEVBQUUsTUFBTSxDQUFDLE9BQU8sQ0FBQyxXQUFXO1lBQ25DLE9BQU8sRUFBRSxHQUFHLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUM7WUFDbEMsVUFBVSxFQUFFLElBQUk7WUFDaEIsV0FBVyxFQUFFO2dCQUNYLFVBQVUsRUFBRSxXQUFXLENBQUMsU0FBUztnQkFDakMsV0FBVyxFQUFFLFFBQVE7YUFDdEI7U0FDRixDQUFDLENBQUM7UUFFSCxtRUFBbUU7UUFDbkUsV0FBVyxDQUFDLGtCQUFrQixDQUFDLFFBQVEsQ0FBQyxDQUFDO1FBRXpDLFdBQVc7UUFFWCwyQkFBMkI7UUFDM0IsdUdBQXVHO1FBQ3ZHLE1BQU0sSUFBSSxHQUFHLElBQUksTUFBTSxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsTUFBTSxFQUFFO1lBQ3pDLG1FQUFtRTtZQUNuRSxRQUFRLEVBQUUsTUFBTSxDQUFDLFFBQVEsQ0FBQyxVQUFVLENBQUMsaUJBQWlCLENBQUM7U0FDeEQsQ0FBQyxDQUFDO1FBRUgsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLE9BQU8sQ0FBQyxjQUFjLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQztJQUN2RCxDQUFDO0NBQ0Y7QUExUUQsMENBMFFDO0FBRUQsTUFBTSxHQUFHLEdBQUcsSUFBSSxHQUFHLENBQUMsR0FBRyxFQUFFLENBQUM7QUFDMUIsSUFBSSxlQUFlLENBQUMsR0FBRyxFQUFFLG1CQUFtQixDQUFDLENBQUM7QUFDOUMsR0FBRyxDQUFDLEtBQUssRUFBRSxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0ICogYXMgczMgZnJvbSBcIkBhd3MtY2RrL2F3cy1zM1wiO1xuaW1wb3J0ICogYXMgZXZlbnRzIGZyb20gXCJAYXdzLWNkay9hd3MtZXZlbnRzXCI7XG5pbXBvcnQgKiBhcyBkeW5hbW9kYiBmcm9tIFwiQGF3cy1jZGsvYXdzLWR5bmFtb2RiXCI7XG5pbXBvcnQgKiBhcyB0YXJnZXRzIGZyb20gXCJAYXdzLWNkay9hd3MtZXZlbnRzLXRhcmdldHNcIjtcbmltcG9ydCAqIGFzIGxhbWJkYSBmcm9tIFwiQGF3cy1jZGsvYXdzLWxhbWJkYVwiO1xuaW1wb3J0ICogYXMgY2RrIGZyb20gXCJAYXdzLWNkay9jb3JlXCI7XG5pbXBvcnQgKiBhcyBpYW0gZnJvbSBcIkBhd3MtY2RrL2F3cy1pYW1cIjtcbmltcG9ydCAqIGFzIHNucyBmcm9tIFwiQGF3cy1jZGsvYXdzLXNuc1wiO1xuaW1wb3J0ICogYXMgc3FzIGZyb20gXCJAYXdzLWNkay9hd3Mtc3FzXCI7XG5pbXBvcnQgKiBhcyBzdWJzY3JpcHRpb25zIGZyb20gXCJAYXdzLWNkay9hd3Mtc25zLXN1YnNjcmlwdGlvbnNcIjtcblxuaW1wb3J0IHtcbiAgRHluYW1vRXZlbnRTb3VyY2UsXG4gIFMzRXZlbnRTb3VyY2UsXG4gIC8vIFNxc0V2ZW50U291cmNlLFxuICBTbnNFdmVudFNvdXJjZVxufSBmcm9tIFwiQGF3cy1jZGsvYXdzLWxhbWJkYS1ldmVudC1zb3VyY2VzXCI7XG5cbi8vIC8vIC8vIC8vXG5cbmV4cG9ydCBjbGFzcyBMYW1iZGFDcm9uU3RhY2sgZXh0ZW5kcyBjZGsuU3RhY2sge1xuICBjb25zdHJ1Y3RvcihhcHA6IGNkay5BcHAsIGlkOiBzdHJpbmcpIHtcbiAgICBzdXBlcihhcHAsIGlkKTtcblxuICAgIC8vIC8vIC8vIC8vXG5cbiAgICBjb25zdCBteVRvcGljID0gbmV3IHNucy5Ub3BpYyh0aGlzLCBcIk15VG9waWNcIik7XG4gICAgY29uc3QgbXlRdWV1ZSA9IG5ldyBzcXMuUXVldWUodGhpcywgXCJNeVF1ZXVlXCIpO1xuXG4gICAgLy8gLy8gLy8gLy9cbiAgICAvLyBEVU5OTyBJRiBUSElTIFdPUktTXG4gICAgLy8qKioqKioqKioqSUFNIFJvbGVzKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgY29uc3QgdGV4dHJhY3RTZXJ2aWNlUm9sZSA9IG5ldyBpYW0uUm9sZSh0aGlzLCBcIlRleHRyYWN0U2VydmljZVJvbGVcIiwge1xuICAgICAgYXNzdW1lZEJ5OiBuZXcgaWFtLlNlcnZpY2VQcmluY2lwYWwoXCJ0ZXh0cmFjdC5hbWF6b25hd3MuY29tXCIpXG4gICAgfSk7XG4gICAgY29uc3QgcG9saWN5U3RhdGVtZW50ID0gbmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoKTtcbiAgICAvLyBwb2xpY3lTdGF0ZW1lbnQuYWRkQWN0aW9ucyhcImlhbTpQYXNzUm9sZVwiKTtcbiAgICAvLyBwb2xpY3lTdGF0ZW1lbnQuYWRkQWN0aW9ucyhcInNuczpQdWJsaXNoXCIpO1xuICAgIC8vIHBvbGljeVN0YXRlbWVudC5hZGRBY3Rpb25zKFwidGV4dHJhY3Q6KlwiKTtcbiAgICBwb2xpY3lTdGF0ZW1lbnQuYWRkQWN0aW9ucyhcIipcIik7XG4gICAgLy8gcG9saWN5U3RhdGVtZW50LmFkZEFjdGlvbnMoXCJ0ZXh0cmFjdDpTdGFydERvY3VtZW50VGV4dERldGVjdGlvblwiKTtcbiAgICAvLyBwb2xpY3lTdGF0ZW1lbnQuYWRkQWN0aW9ucyhcInRleHRyYWN0OkdldERvY3VtZW50QW5hbHlzaXNcIik7XG4gICAgLy8gcG9saWN5U3RhdGVtZW50LmFkZEFjdGlvbnMoXCJ0ZXh0cmFjdDpTdGFydERvY3VtZW50VGV4dERldGVjdGlvblwiKTtcbiAgICAvLyBwb2xpY3lTdGF0ZW1lbnQuYWRkUmVzb3VyY2VzKG15VG9waWMudG9waWNBcm4pO1xuICAgIHBvbGljeVN0YXRlbWVudC5hZGRSZXNvdXJjZXMoXCIqXCIpO1xuICAgIC8vIHBvbGljeVN0YXRlbWVudC5hZGRSZXNvdXJjZXModGV4dHJhY3RTZXJ2aWNlUm9sZS5yb2xlQXJuKTtcbiAgICAvLyBwb2xpY3lTdGF0ZW1lbnQuYWRkU2VydmljZVByaW5jaXBhbChcImVjMi5hbWF6b25hd3MuY29tXCIpO1xuICAgIHRleHRyYWN0U2VydmljZVJvbGUuYWRkVG9Qb2xpY3kocG9saWN5U3RhdGVtZW50KTtcblxuICAgIC8vIFN1YnNjcmliZXMgcXVldWUgdG8gdG9waWNcbiAgICBteVRvcGljLmFkZFN1YnNjcmlwdGlvbihuZXcgc3Vic2NyaXB0aW9ucy5TcXNTdWJzY3JpcHRpb24obXlRdWV1ZSkpO1xuXG4gICAgLy8gLy8gLy8gLy9cblxuICAgIC8vIERlZmluZXMgUzMgYnVja2V0IGZvciBkb3dubG9hZGVkIFBERnNcbiAgICAvLyBUT0RPIC0gc2V0dXAgbG9nZ2luZyBmb3IgUzMgYnVja2V0XG4gICAgLy8gRG9jOiBodHRwczovL2RvY3MuYXdzLmFtYXpvbi5jb20vY2RrL2FwaS9sYXRlc3QvZG9jcy9hd3MtczMtcmVhZG1lLmh0bWwjbG9nZ2luZy1jb25maWd1cmF0aW9uXG4gICAgY29uc3QgZG93bmxvYWRzQnVja2V0OiBzMy5CdWNrZXQgPSBuZXcgczMuQnVja2V0KFxuICAgICAgdGhpcyxcbiAgICAgIFwiY29nY2NfcGRmX2Rvd25sb2Fkc19idWNrZXRcIlxuICAgICk7XG5cbiAgICAvLyAvLyAvLyAvL1xuXG4gICAgLy8gRGVmaW5lcyBkeW5hbW9UYWJsZSBmb3IgUERGIERvd25sb2FkIFVSTHNcbiAgICBjb25zdCBkeW5hbW9UYWJsZSA9IG5ldyBkeW5hbW9kYi5UYWJsZSh0aGlzLCBcImNvZ2NjLXBkZi11cmxzXCIsIHtcbiAgICAgIHBhcnRpdGlvbktleToge1xuICAgICAgICBuYW1lOiBcIml0ZW1JZFwiLFxuICAgICAgICB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklOR1xuICAgICAgfSxcbiAgICAgIHN0cmVhbTogZHluYW1vZGIuU3RyZWFtVmlld1R5cGUuTkVXX0lNQUdFLCAvLyBDb25maWd1cmUgc3RyZWFtc1xuICAgICAgdGFibGVOYW1lOiBcImNvZ2NjLXBkZi11cmxzXCIsXG5cbiAgICAgIC8vIFRoZSBkZWZhdWx0IHJlbW92YWwgcG9saWN5IGlzIFJFVEFJTiwgd2hpY2ggbWVhbnMgdGhhdCBjZGsgZGVzdHJveSB3aWxsIG5vdCBhdHRlbXB0IHRvIGRlbGV0ZVxuICAgICAgLy8gdGhlIG5ldyB0YWJsZSwgYW5kIGl0IHdpbGwgcmVtYWluIGluIHlvdXIgYWNjb3VudCB1bnRpbCBtYW51YWxseSBkZWxldGVkLiBCeSBzZXR0aW5nIHRoZSBwb2xpY3kgdG9cbiAgICAgIC8vIERFU1RST1ksIGNkayBkZXN0cm95IHdpbGwgZGVsZXRlIHRoZSB0YWJsZSAoZXZlbiBpZiBpdCBoYXMgZGF0YSBpbiBpdClcbiAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1kgLy8gTk9UIHJlY29tbWVuZGVkIGZvciBwcm9kdWN0aW9uIGNvZGVcbiAgICB9KTtcblxuICAgIC8vIC8vIC8vIC8vXG5cbiAgICAvLyBEZWZpbmVzIER5YW5tb0RCIHRhYmxlIGZvciBwYXJzZWQgUERGIGRhdGFcbiAgICBjb25zdCBwYXJzZWRQZGZEYXRhVGFibGUgPSBuZXcgZHluYW1vZGIuVGFibGUodGhpcywgXCJjb2djYy1wZGYtZGF0YVwiLCB7XG4gICAgICBwYXJ0aXRpb25LZXk6IHtcbiAgICAgICAgbmFtZTogXCJpdGVtSWRcIixcbiAgICAgICAgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkdcbiAgICAgIH0sXG4gICAgICBzdHJlYW06IGR5bmFtb2RiLlN0cmVhbVZpZXdUeXBlLk5FV19JTUFHRSwgLy8gQ29uZmlndXJlIHN0cmVhbXNcbiAgICAgIHRhYmxlTmFtZTogXCJjb2djYy1wZGYtZGF0YVwiLFxuXG4gICAgICAvLyBUaGUgZGVmYXVsdCByZW1vdmFsIHBvbGljeSBpcyBSRVRBSU4sIHdoaWNoIG1lYW5zIHRoYXQgY2RrIGRlc3Ryb3kgd2lsbCBub3QgYXR0ZW1wdCB0byBkZWxldGVcbiAgICAgIC8vIHRoZSBuZXcgdGFibGUsIGFuZCBpdCB3aWxsIHJlbWFpbiBpbiB5b3VyIGFjY291bnQgdW50aWwgbWFudWFsbHkgZGVsZXRlZC4gQnkgc2V0dGluZyB0aGUgcG9saWN5IHRvXG4gICAgICAvLyBERVNUUk9ZLCBjZGsgZGVzdHJveSB3aWxsIGRlbGV0ZSB0aGUgdGFibGUgKGV2ZW4gaWYgaXQgaGFzIGRhdGEgaW4gaXQpXG4gICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZIC8vIE5PVCByZWNvbW1lbmRlZCBmb3IgcHJvZHVjdGlvbiBjb2RlXG4gICAgfSk7XG5cbiAgICAvLyBMYW1iZGEgdG8gZG93bmxvYWQgZmlsZXMgYW5kIGluc2VydCB0aGVtIGludG8gUzNcbiAgICBjb25zdCBzZW5kUGRmVG9UZXh0cmFjdExhbWJkYSA9IG5ldyBsYW1iZGEuRnVuY3Rpb24oXG4gICAgICB0aGlzLFxuICAgICAgXCJzZW5kUGRmVG9UZXh0cmFjdExhbWJkYUZ1bmN0aW9uXCIsXG4gICAgICB7XG4gICAgICAgIGNvZGU6IG5ldyBsYW1iZGEuQXNzZXRDb2RlKFwic3JjXCIpLFxuICAgICAgICBoYW5kbGVyOiBcInNlbmQtcGRmLXRvLXRleHRyYWN0LmhhbmRsZXJcIixcbiAgICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzEwX1gsXG4gICAgICAgIGVudmlyb25tZW50OiB7XG4gICAgICAgICAgVEFCTEVfTkFNRTogcGFyc2VkUGRmRGF0YVRhYmxlLnRhYmxlTmFtZSxcbiAgICAgICAgICBQUklNQVJZX0tFWTogXCJpdGVtSWRcIixcbiAgICAgICAgICAvLyBTTlNfVE9QSUNfQVJOOiBqb2JDb21wbGV0aW9uVG9waWMudG9waWNBcm4sXG4gICAgICAgICAgLy8gQVNZTkNfUVVFVUVfVVJMOiBhc3luY0pvYnNRdWV1ZS5xdWV1ZVVybCxcbiAgICAgICAgICAvLyBTTlNfUk9MRV9BUk46IHRleHRyYWN0U2VydmljZVJvbGUucm9sZUFybixcbiAgICAgICAgICBTM19CVUNLRVRfTkFNRTogZG93bmxvYWRzQnVja2V0LmJ1Y2tldE5hbWVcblxuICAgICAgICAgIC8vIHJlcXVlc3RbXCJxVXJsXCJdID0gb3MuZW52aXJvblsnQVNZTkNfUVVFVUVfVVJMJ11cbiAgICAgICAgICAvLyByZXF1ZXN0W1wic25zUm9sZVwiXSA9IG9zLmVudmlyb25bJ1NOU19ST0xFX0FSTiddXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICApO1xuXG4gICAgLy8gQWRkcyBwZXJtaXNzaW9ucyBmb3IgdGhlIHNlbmRQZGZUb1RleHRyYWN0TGFtYmRhdG8gcmVhZC93cml0ZSBmcm9tIHBhcnNlZFBkZkRhdGFUYWJsZSArIGRvd25sb2Fkc0J1Y2tldFxuICAgIHBhcnNlZFBkZkRhdGFUYWJsZS5ncmFudFJlYWRXcml0ZURhdGEoc2VuZFBkZlRvVGV4dHJhY3RMYW1iZGEpO1xuICAgIGRvd25sb2Fkc0J1Y2tldC5ncmFudFJlYWRXcml0ZShzZW5kUGRmVG9UZXh0cmFjdExhbWJkYSk7XG5cbiAgICAvLyBDb25maWd1cmUgZXZlbnQgc291cmNlIHNvIHRoZSBgc2VuZFBkZlRvVGV4dHJhY3RMYW1iZGFgIGlzIHJ1biBlYWNoIHRpbWUgYSBmaWxlIGlzIGRvd25sb2FkZWQgdG8gUzNcbiAgICAvLyBEb2M6IGh0dHBzOi8vZG9jcy5hd3MuYW1hem9uLmNvbS9jZGsvYXBpL2xhdGVzdC9kb2NzL2F3cy1sYW1iZGEtZXZlbnQtc291cmNlcy1yZWFkbWUuaHRtbCNzM1xuICAgIC8vIHNlbmRQZGZUb1RleHRyYWN0TGFtYmRhLmFkZEV2ZW50U291cmNlKFxuICAgIC8vICAgbmV3IFMzRXZlbnRTb3VyY2UoZG93bmxvYWRzQnVja2V0LCB7XG4gICAgLy8gICAgIGV2ZW50czogW3MzLkV2ZW50VHlwZS5PQkpFQ1RfQ1JFQVRFRF1cbiAgICAvLyAgIH0pXG4gICAgLy8gKTtcblxuICAgIC8vIC8vIC8vIC8vXG5cbiAgICAvLyBhZGRUb1F1ZXVlIExhbWJkYVxuICAgIGNvbnN0IGFkZFRvUXVldWUgPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsIFwiYWRkVG9RdWV1ZUxhbWJkYUZ1bmN0aW9uXCIsIHtcbiAgICAgIGNvZGU6IG5ldyBsYW1iZGEuQXNzZXRDb2RlKFwic3JjXCIpLFxuICAgICAgaGFuZGxlcjogXCJxdWV1ZUFkZC5oYW5kbGVyXCIsXG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5OT0RFSlNfMTBfWCxcbiAgICAgIGVudmlyb25tZW50OiB7XG4gICAgICAgIFRBQkxFX05BTUU6IHBhcnNlZFBkZkRhdGFUYWJsZS50YWJsZU5hbWUsXG4gICAgICAgIFBSSU1BUllfS0VZOiBcIml0ZW1JZFwiLFxuICAgICAgICBTM19CVUNLRVRfTkFNRTogZG93bmxvYWRzQnVja2V0LmJ1Y2tldE5hbWUsXG4gICAgICAgIFNOU19UT1BJQ19BUk46IG15VG9waWMudG9waWNBcm4sXG4gICAgICAgIFNOU19ST0xFX0FSTjogdGV4dHJhY3RTZXJ2aWNlUm9sZS5yb2xlQXJuLFxuICAgICAgICBTUVNfVVJMOiBteVF1ZXVlLnF1ZXVlVXJsXG4gICAgICB9XG4gICAgfSk7XG5cbiAgICAvLyBDb25maWd1cmUgZXZlbnQgc291cmNlIHNvIHRoZSBgYWRkVG9RdWV1ZWAgaXMgcnVuIGVhY2ggdGltZSBhIGZpbGUgaXMgZG93bmxvYWRlZCB0byBTM1xuICAgIC8vIERvYzogaHR0cHM6Ly9kb2NzLmF3cy5hbWF6b24uY29tL2Nkay9hcGkvbGF0ZXN0L2RvY3MvYXdzLWxhbWJkYS1ldmVudC1zb3VyY2VzLXJlYWRtZS5odG1sI3MzXG4gICAgYWRkVG9RdWV1ZS5hZGRFdmVudFNvdXJjZShcbiAgICAgIG5ldyBTM0V2ZW50U291cmNlKGRvd25sb2Fkc0J1Y2tldCwge1xuICAgICAgICBldmVudHM6IFtzMy5FdmVudFR5cGUuT0JKRUNUX0NSRUFURURdXG4gICAgICB9KVxuICAgICk7XG5cbiAgICAvLyBBZGRzIHBlcm1pc3Npb25zIGZvciB0aGUgYWRkVG9RdWV1ZSByZWFkL3dyaXRlIGZyb20gcGFyc2VkUGRmRGF0YVRhYmxlICsgZG93bmxvYWRzQnVja2V0XG4gICAgbXlRdWV1ZS5ncmFudFNlbmRNZXNzYWdlcyhhZGRUb1F1ZXVlKTtcbiAgICBteVRvcGljLmdyYW50UHVibGlzaChhZGRUb1F1ZXVlKTtcbiAgICBteVRvcGljLmdyYW50UHVibGlzaCh0ZXh0cmFjdFNlcnZpY2VSb2xlKTtcbiAgICBwYXJzZWRQZGZEYXRhVGFibGUuZ3JhbnRSZWFkV3JpdGVEYXRhKGFkZFRvUXVldWUpO1xuICAgIGRvd25sb2Fkc0J1Y2tldC5ncmFudFJlYWRXcml0ZShhZGRUb1F1ZXVlKTtcblxuICAgIC8vIC8vIC8vIC8vXG5cbiAgICAvLyBxdWV1ZUhhbmRsZXIgTGFtYmRhXG4gICAgY29uc3QgcXVldWVIYW5kbGVyID0gbmV3IGxhbWJkYS5GdW5jdGlvbihcbiAgICAgIHRoaXMsXG4gICAgICBcInF1ZXVlSGFuZGxlckxhbWJkYUZ1bmN0aW9uXCIsXG4gICAgICB7XG4gICAgICAgIGNvZGU6IG5ldyBsYW1iZGEuQXNzZXRDb2RlKFwic3JjXCIpLFxuICAgICAgICBoYW5kbGVyOiBcInF1ZXVlSGFuZGxlci5oYW5kbGVyXCIsXG4gICAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18xMF9YLFxuICAgICAgICBlbnZpcm9ubWVudDoge1xuICAgICAgICAgIFRBQkxFX05BTUU6IHBhcnNlZFBkZkRhdGFUYWJsZS50YWJsZU5hbWUsXG4gICAgICAgICAgUFJJTUFSWV9LRVk6IFwiaXRlbUlkXCIsXG4gICAgICAgICAgU05TX1RPUElDX0FSTjogbXlUb3BpYy50b3BpY0FybixcbiAgICAgICAgICBTTlNfUk9MRV9BUk46IHRleHRyYWN0U2VydmljZVJvbGUucm9sZUFybixcbiAgICAgICAgICBTM19CVUNLRVRfTkFNRTogZG93bmxvYWRzQnVja2V0LmJ1Y2tldE5hbWUsXG4gICAgICAgICAgU1FTX1VSTDogbXlRdWV1ZS5xdWV1ZVVybFxuICAgICAgICB9XG4gICAgICB9XG4gICAgKTtcblxuICAgIC8vIEZlZWRzIHF1ZXVlIGludG8gZnVuY3Rpb24gZXZlcnkgMiBtaW51dGVzXG4gICAgY29uc3QgYXN5bmNRdWV1ZUNyb25SdWxlID0gbmV3IGV2ZW50cy5SdWxlKHRoaXMsIFwiQXN5bmNRdWV1ZVJ1bGVcIiwge1xuICAgICAgc2NoZWR1bGU6IGV2ZW50cy5TY2hlZHVsZS5leHByZXNzaW9uKFwicmF0ZSgyIG1pbnV0ZXMpXCIpXG4gICAgfSk7XG5cbiAgICAvLyBBZGRzIHF1ZXVlSGFuZGxlciBhcyB0YXJnZXQgZm9yIHF1ZXVlIGNyb24gcnVsZVxuICAgIGFzeW5jUXVldWVDcm9uUnVsZS5hZGRUYXJnZXQobmV3IHRhcmdldHMuTGFtYmRhRnVuY3Rpb24ocXVldWVIYW5kbGVyKSk7XG5cbiAgICAvLyBBZGRzIHBlcm1pc3Npb25zIGZvciB0aGUgcXVldWVIYW5kbGVyIHJlYWQvd3JpdGUgZnJvbSBwYXJzZWRQZGZEYXRhVGFibGUgKyBkb3dubG9hZHNCdWNrZXRcbiAgICBwYXJzZWRQZGZEYXRhVGFibGUuZ3JhbnRSZWFkV3JpdGVEYXRhKHF1ZXVlSGFuZGxlcik7XG4gICAgZG93bmxvYWRzQnVja2V0LmdyYW50UmVhZFdyaXRlKHF1ZXVlSGFuZGxlcik7XG4gICAgbXlRdWV1ZS5ncmFudENvbnN1bWVNZXNzYWdlcyhxdWV1ZUhhbmRsZXIpO1xuXG4gICAgLy8gLy8gLy8gLy9cblxuICAgIC8vIHF1ZXVlUmVzdWx0IExhbWJkYVxuICAgIGNvbnN0IHF1ZXVlUmVzdWx0ID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCBcInF1ZXVlUmVzdWx0TGFtYmRhRnVuY3Rpb25cIiwge1xuICAgICAgY29kZTogbmV3IGxhbWJkYS5Bc3NldENvZGUoXCJzcmNcIiksXG4gICAgICBoYW5kbGVyOiBcInF1ZXVlUmVzdWx0LmhhbmRsZXJcIixcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18xMF9YLFxuICAgICAgZW52aXJvbm1lbnQ6IHtcbiAgICAgICAgVEFCTEVfTkFNRTogcGFyc2VkUGRmRGF0YVRhYmxlLnRhYmxlTmFtZSxcbiAgICAgICAgUFJJTUFSWV9LRVk6IFwiaXRlbUlkXCIsXG4gICAgICAgIFNOU19UT1BJQ19BUk46IG15VG9waWMudG9waWNBcm4sXG4gICAgICAgIFNOU19ST0xFX0FSTjogdGV4dHJhY3RTZXJ2aWNlUm9sZS5yb2xlQXJuLFxuICAgICAgICBTM19CVUNLRVRfTkFNRTogZG93bmxvYWRzQnVja2V0LmJ1Y2tldE5hbWVcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIC8vIEFkZHMgcGVybWlzc2lvbnMgZm9yIHRoZSBxdWV1ZVJlc3VsdCByZWFkL3dyaXRlIGZyb20gcGFyc2VkUGRmRGF0YVRhYmxlICsgZG93bmxvYWRzQnVja2V0XG4gICAgcGFyc2VkUGRmRGF0YVRhYmxlLmdyYW50UmVhZFdyaXRlRGF0YShxdWV1ZVJlc3VsdCk7XG4gICAgZG93bmxvYWRzQnVja2V0LmdyYW50UmVhZFdyaXRlKHF1ZXVlUmVzdWx0KTtcbiAgICBteVF1ZXVlLmdyYW50Q29uc3VtZU1lc3NhZ2VzKHF1ZXVlUmVzdWx0KTtcblxuICAgIC8vIFRPRE8gLSB0cnkgdGhpcyB0b28uLi5cbiAgICBxdWV1ZVJlc3VsdC5hZGRFdmVudFNvdXJjZShuZXcgU25zRXZlbnRTb3VyY2UobXlUb3BpYykpO1xuICAgIHF1ZXVlUmVzdWx0LmFkZFRvUm9sZVBvbGljeShwb2xpY3lTdGF0ZW1lbnQpO1xuICAgIC8vIHF1ZXVlUmVzdWx0LmFkZEV2ZW50U291cmNlKFxuICAgIC8vICAgbmV3IFNxc0V2ZW50U291cmNlKG15UXVldWUsIHtcbiAgICAvLyAgICAgYmF0Y2hTaXplOiAxXG4gICAgLy8gICB9KVxuICAgIC8vICk7XG5cbiAgICAvLyAvLyAvLyAvL1xuXG4gICAgLy8gTGFtYmRhIHRvIGRvd25sb2FkIGZpbGVzIGFuZCBpbnNlcnQgdGhlbSBpbnRvIFMzXG4gICAgY29uc3QgZmlsZURvd25sb2FkZXJMYW1iZGEgPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKFxuICAgICAgdGhpcyxcbiAgICAgIFwiZmlsZURvd25sb2FkZXJMYW1iZGFGdW5jdGlvblwiLFxuICAgICAge1xuICAgICAgICBjb2RlOiBuZXcgbGFtYmRhLkFzc2V0Q29kZShcInNyY1wiKSxcbiAgICAgICAgaGFuZGxlcjogXCJkb3dubG9hZC1maWxlLmhhbmRsZXJcIixcbiAgICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzEwX1gsXG4gICAgICAgIGVudmlyb25tZW50OiB7XG4gICAgICAgICAgVEFCTEVfTkFNRTogZHluYW1vVGFibGUudGFibGVOYW1lLFxuICAgICAgICAgIFMzX0JVQ0tFVF9OQU1FOiBkb3dubG9hZHNCdWNrZXQuYnVja2V0TmFtZSxcbiAgICAgICAgICBQUklNQVJZX0tFWTogXCJpdGVtSWRcIlxuICAgICAgICB9XG4gICAgICB9XG4gICAgKTtcblxuICAgIC8vIEFkZHMgcGVybWlzc2lvbnMgZm9yIHRoZSBsYW1iZGFGbiB0byByZWFkL3dyaXRlIGZyb20gZHluYW1vVGFibGUgKyBkb3dubG9hZHNCdWNrZXRcbiAgICBkeW5hbW9UYWJsZS5ncmFudFJlYWRXcml0ZURhdGEoZmlsZURvd25sb2FkZXJMYW1iZGEpO1xuICAgIGRvd25sb2Fkc0J1Y2tldC5ncmFudFJlYWRXcml0ZShmaWxlRG93bmxvYWRlckxhbWJkYSk7XG5cbiAgICAvLyBBZGQgRHluYW1vREIgc3RyZWFtIGV2ZW50IHNvdXJjZSB0byBmaWxlRG93bmxvYWRlckxhbWJkYVxuICAgIC8vIEludm9rZWQgb25jZS1wZXItZG9jdW1lbnRcbiAgICBmaWxlRG93bmxvYWRlckxhbWJkYS5hZGRFdmVudFNvdXJjZShcbiAgICAgIG5ldyBEeW5hbW9FdmVudFNvdXJjZShkeW5hbW9UYWJsZSwge1xuICAgICAgICBzdGFydGluZ1Bvc2l0aW9uOiBsYW1iZGEuU3RhcnRpbmdQb3NpdGlvbi5UUklNX0hPUklaT04sXG4gICAgICAgIGJhdGNoU2l6ZTogMVxuICAgICAgfSlcbiAgICApO1xuXG4gICAgLy8gLy8gLy8gLy9cblxuICAgIC8vIERvd25sb2FkVVJMIENyYXdsZXIgTGFtYmRhXG4gICAgY29uc3QgbGFtYmRhRm4gPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsIFwiZmV0Y2hQZGZEb3dubG9hZFVybHNGdW5jdGlvblwiLCB7XG4gICAgICBjb2RlOiBuZXcgbGFtYmRhLkFzc2V0Q29kZShcInNyY1wiKSxcbiAgICAgIGhhbmRsZXI6IFwiZmV0Y2gtcGRmcy5oYW5kbGVyXCIsXG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5OT0RFSlNfMTBfWCxcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDMwMCksXG4gICAgICBtZW1vcnlTaXplOiAxMDI0LFxuICAgICAgZW52aXJvbm1lbnQ6IHtcbiAgICAgICAgVEFCTEVfTkFNRTogZHluYW1vVGFibGUudGFibGVOYW1lLFxuICAgICAgICBQUklNQVJZX0tFWTogXCJpdGVtSWRcIlxuICAgICAgfVxuICAgIH0pO1xuXG4gICAgLy8gQWRkcyBwZXJtaXNzaW9ucyBmb3IgdGhlIGxhbWJkYUZuIHRvIHJlYWQvd3JpdGUgZnJvbSBkeW5hbW9UYWJsZVxuICAgIGR5bmFtb1RhYmxlLmdyYW50UmVhZFdyaXRlRGF0YShsYW1iZGFGbik7XG5cbiAgICAvLyAvLyAvLyAvL1xuXG4gICAgLy8gUnVuIGV2ZXJ5IGRheSBhdCA2UE0gVVRDXG4gICAgLy8gU2VlIGh0dHBzOi8vZG9jcy5hd3MuYW1hem9uLmNvbS9sYW1iZGEvbGF0ZXN0L2RnL3R1dG9yaWFsLXNjaGVkdWxlZC1ldmVudHMtc2NoZWR1bGUtZXhwcmVzc2lvbnMuaHRtbFxuICAgIGNvbnN0IHJ1bGUgPSBuZXcgZXZlbnRzLlJ1bGUodGhpcywgXCJSdWxlXCIsIHtcbiAgICAgIC8vIHNjaGVkdWxlOiBldmVudHMuU2NoZWR1bGUuZXhwcmVzc2lvbihcImNyb24oMCAxOCA/ICogTU9OLUZSSSAqKVwiKVxuICAgICAgc2NoZWR1bGU6IGV2ZW50cy5TY2hlZHVsZS5leHByZXNzaW9uKFwicmF0ZSgyIG1pbnV0ZXMpXCIpXG4gICAgfSk7XG5cbiAgICBydWxlLmFkZFRhcmdldChuZXcgdGFyZ2V0cy5MYW1iZGFGdW5jdGlvbihsYW1iZGFGbikpO1xuICB9XG59XG5cbmNvbnN0IGFwcCA9IG5ldyBjZGsuQXBwKCk7XG5uZXcgTGFtYmRhQ3JvblN0YWNrKGFwcCwgXCJMYW1iZGFDcm9uRXhhbXBsZVwiKTtcbmFwcC5zeW50aCgpO1xuIl19