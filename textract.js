const request = {
  DocumentLocation: {
    S3Object: {
      Bucket: "lambdacronexample-cogccpdfdownloadsbucket93b40e01-1kn95iu6zt174",
      Name: "5055255.pdf"
    }
  },
  // ClientRequestToken: "5055255.pdf",
  // JobTag: "FORM_04",
  // FeatureTypes: ["TABLES", "FORMS"],
  NotificationChannel: {
    RoleArn:
      "arn:aws:iam::839811712080:role/LambdaCronExample-TextractServiceRole720C3B18-VIUVDJ5I92EU",
    SNSTopicArn:
      "arn:aws:sns:us-west-2:839811712080:LambdaCronExample-MyTopic86869434-GNU4OYHJJK2B"
  }
};

const AWS = require("aws-sdk");
const textract = new AWS.Textract({ region: "us-west-2" });

const handler = async () => {
  console.log("ADD TO QUEUE");

  // // // //

  await new Promise(resolve => {
    return textract.startDocumentTextDetection(request, function(err, data) {
      // if (err) console.log(err, err.stack);
      // an error occurred
      // else console.log(data); // successful response
      console.log("START DOCUMENT TEXT DETECTION");
      console.log("err");
      console.log(err);
      console.log("data");
      console.log(data);
      resolve(data);
    });
  });

  console.log("Function shut down");
  return;

  // // // //
  // // // //
  // SQS Code
  //
  // const sqs = new AWS.SQS({ endpoint: SQS_URL, region: "us-west-2"  });
  // var params: AWS.SQS.SendMessageRequest = {
  //   MessageBody: JSON.stringify({ text: "My Text Here" }),
  //   QueueUrl: SQS_URL,
  //   MessageAttributes: {
  //     name: {
  //       StringValue: "Request Name Here!",
  //       DataType: "String"
  //     }
  //   }
  //   // MessageGroupId: "TestMessageGroup"
  // };

  // SENDS MESSAGE ON QUEUE
  // await new Promise(resolve => {
  //   sqs.sendMessage(params, function(err, data) {
  //     console.log("SEND MESSAGE");
  //     console.log(err);
  //     console.log(data);
  //     resolve(data);

  //     // if (err) console.log(err, err.stack);
  //     // // an error occurred
  //     // else console.log(data); // successful response
  //   });
  // });
  //
  // // // //
  // // // //

  // Detect the document's text with Textract
  // await new Promise(resolve => {
  //   textract.startDocumentTextDetection(
  //     textractParams,
  //     async (err: any, data: any) => {
  //       console.log("DONE ANALYZING DOCUMENT");
  //       console.log(err);
  //       console.log(data);

  //       if (err) {
  //         console.log(err, err.stack);
  //         return;
  //       }

  //       // Debug Textract response
  //       console.log("Textract Response");
  //       console.log(JSON.stringify(data, null, 4));

  //       // Defines the item we're inserting into the database
  //       const item: any = {
  //         [PRIMARY_KEY]: filename.replace(".pdf", ""),
  //         // primary_contact_name: "John Doe"
  //         data: {
  //           ...data
  //         }
  //       };

  //       // Defines the params for db.put
  //       const dynamoParams = {
  //         TableName: TABLE_NAME,
  //         Item: item
  //       };

  //       // Inserts the record into the DynamoDB table
  //       await db.put(dynamoParams).promise();
  //       return resolve();
  //     }
  //   );
  // });

  // return;

  // // // //
  // // // //
  // // // //
  // // // //

  // Defines the item we're inserting into the database
  // const item: any = {
  //   [PRIMARY_KEY]: Math.random().toString(),
  //   primary_contact_name: "John Doe"
  // };

  // // Defines the params for db.put
  // const dynamoParams = {
  //   TableName: TABLE_NAME,
  //   Item: item
  // };

  // // Inserts the record into the DynamoDB table
  // return db.put(dynamoParams).promise();
};

// // // //

handler();
