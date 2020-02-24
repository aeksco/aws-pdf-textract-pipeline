import * as AWS from "aws-sdk";
const SNS_TOPIC_ARN = process.env.SNS_TOPIC_ARN || "";
const SNS_ROLE_ARN = process.env.SNS_ROLE_ARN || "";
const SQS_URL = process.env.SQS_URL || "";

export const handler = async (event: any = {}): Promise<any> => {
  console.log("QUEUE HANDLER");
  console.log(SNS_TOPIC_ARN);
  console.log(SNS_ROLE_ARN);
  console.log(SQS_URL);
  console.log(JSON.stringify(event, null, 4));

  const sqs = new AWS.SQS({ endpoint: SQS_URL, region: "us-west-2" });

  const params: AWS.SQS.ReceiveMessageRequest = {
    QueueUrl: SQS_URL,
    AttributeNames: ["All"],
    MaxNumberOfMessages: 1,
    MessageAttributeNames: ["All"],
    VisibilityTimeout: 20
    // WaitTimeSeconds: 10
  };

  console.log(params);

  // RECEIVE MESSAGES FROM QUEUE
  await new Promise(resolve => {
    sqs.receiveMessage(params, (err: any, result: any) => {
      console.log("RECEIVED MESSAGES");
      console.log("YEAHHH");
      console.log(JSON.stringify(result, null, 4));
      console.log(err);
      resolve(result.Messages);
    });
  });
};
