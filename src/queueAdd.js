"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const AWS = require("aws-sdk");
const textract = new AWS.Textract({ region: "us-west-2" });
const SNS_TOPIC_ARN = process.env.SNS_TOPIC_ARN || "";
const SNS_ROLE_ARN = process.env.SNS_ROLE_ARN || "";
const S3_BUCKET_NAME = process.env.S3_BUCKET_NAME || "";
const SQS_URL = process.env.SQS_URL || "";
exports.handler = async (event = {}) => {
    console.log("ADD TO QUEUE");
    console.log("SNS_TOPIC_ARN");
    console.log(SNS_TOPIC_ARN);
    console.log("SNS_ROLE_ARN");
    console.log(SNS_ROLE_ARN);
    console.log("SQS_URL");
    console.log(SQS_URL);
    console.log(JSON.stringify(event, null, 4));
    // Pulls filename from event
    const filename = event["Records"][0]["s3"]["object"]["key"];
    // Short-circuit if filename isn't defined
    if (!filename) {
        console.log("ERROR - filename");
    }
    console.log("filename: " + filename);
    // // Defines params for Textract API call
    // const textractParams: AWS.Textract.AnalyzeDocumentRequest = {
    //   Document: {
    //     S3Object: {
    //       Bucket: S3_BUCKET_NAME,
    //       Name: filename
    //       // Version: "STRING_VALUE"
    //     }
    //   },
    //   FeatureTypes: ["TABLES", "FORMS"]
    // };
    // console.log("textractParams");
    // console.log(textractParams);
    // // // //
    // // // //
    var params = {
        DocumentLocation: {
            S3Object: {
                Bucket: S3_BUCKET_NAME,
                Name: filename
                // Version: "STRING_VALUE"
            }
        },
        // ClientRequestToken: filename,
        // JobTag: "FORM_04",
        NotificationChannel: {
            RoleArn: SNS_ROLE_ARN,
            SNSTopicArn: SNS_TOPIC_ARN
        }
    };
    console.log("params");
    console.log(params);
    await new Promise(resolve => {
        return textract.startDocumentTextDetection(params, function (err, data) {
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicXVldWVBZGQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJxdWV1ZUFkZC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQUFBLCtCQUErQjtBQUMvQixNQUFNLFFBQVEsR0FBRyxJQUFJLEdBQUcsQ0FBQyxRQUFRLENBQUMsRUFBRSxNQUFNLEVBQUUsV0FBVyxFQUFFLENBQUMsQ0FBQztBQUMzRCxNQUFNLGFBQWEsR0FBRyxPQUFPLENBQUMsR0FBRyxDQUFDLGFBQWEsSUFBSSxFQUFFLENBQUM7QUFDdEQsTUFBTSxZQUFZLEdBQUcsT0FBTyxDQUFDLEdBQUcsQ0FBQyxZQUFZLElBQUksRUFBRSxDQUFDO0FBQ3BELE1BQU0sY0FBYyxHQUFHLE9BQU8sQ0FBQyxHQUFHLENBQUMsY0FBYyxJQUFJLEVBQUUsQ0FBQztBQUN4RCxNQUFNLE9BQU8sR0FBRyxPQUFPLENBQUMsR0FBRyxDQUFDLE9BQU8sSUFBSSxFQUFFLENBQUM7QUFFN0IsUUFBQSxPQUFPLEdBQUcsS0FBSyxFQUFFLFFBQWEsRUFBRSxFQUFnQixFQUFFO0lBQzdELE9BQU8sQ0FBQyxHQUFHLENBQUMsY0FBYyxDQUFDLENBQUM7SUFDNUIsT0FBTyxDQUFDLEdBQUcsQ0FBQyxlQUFlLENBQUMsQ0FBQztJQUM3QixPQUFPLENBQUMsR0FBRyxDQUFDLGFBQWEsQ0FBQyxDQUFDO0lBQzNCLE9BQU8sQ0FBQyxHQUFHLENBQUMsY0FBYyxDQUFDLENBQUM7SUFDNUIsT0FBTyxDQUFDLEdBQUcsQ0FBQyxZQUFZLENBQUMsQ0FBQztJQUMxQixPQUFPLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxDQUFDO0lBQ3ZCLE9BQU8sQ0FBQyxHQUFHLENBQUMsT0FBTyxDQUFDLENBQUM7SUFDckIsT0FBTyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLEtBQUssRUFBRSxJQUFJLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUU1Qyw0QkFBNEI7SUFDNUIsTUFBTSxRQUFRLEdBQUcsS0FB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bEIsb0JBQW9CO0lBQ3BCLFlBQVk7SUFDWixXQUFXO0lBRVgseUNBQXlDO0lBQ3pDLCtCQUErQjtJQUMvQixpQ0FBaUM7SUFDakMscUJBQXFCO0lBQ3JCLFdBQVc7SUFFWCxzREFBc0Q7SUFDdEQsOENBQThDO0lBQzlDLDBCQUEwQjtJQUMxQixRQUFRO0lBQ1IsT0FBTztJQUNQLE1BQU07SUFFTixVQUFVO0lBRVYsV0FBVztJQUNYLFdBQVc7SUFDWCxXQUFXO0lBQ1gsV0FBVztJQUVYLHFEQUFxRDtJQUNyRCxzQkFBc0I7SUFDdEIsNkNBQTZDO0lBQzdDLHFDQUFxQztJQUNyQyxLQUFLO0lBRUwsbUNBQW1DO0lBQ25DLHlCQUF5QjtJQUN6QiwyQkFBMkI7SUFDM0IsZUFBZTtJQUNmLEtBQUs7SUFFTCxnREFBZ0Q7SUFDaEQseUNBQXlDO0FBQzNDLENBQUMsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIEFXUyBmcm9tIFwiYXdzLXNka1wiO1xuY29uc3QgdGV4dHJhY3QgPSBuZXcgQVdTLlRleHRyYWN0KHsgcmVnaW9uOiBcInVzLXdlc3QtMlwiIH0pO1xuY29uc3QgU05TX1RPUElDX0FSTiA9IHByb2Nlc3MuZW52LlNOU19UT1BJQ19BUk4gfHwgXCJcIjtcbmNvbnN0IFNOU19ST0xFX0FSTiA9IHByb2Nlc3MuZW52LlNOU19ST0xFX0FSTiB8fCBcIlwiO1xuY29uc3QgUzNfQlVDS0VUX05BTUUgPSBwcm9jZXNzLmVudi5TM19CVUNLRVRfTkFNRSB8fCBcIlwiO1xuY29uc3QgU1FTX1VSTCA9IHByb2Nlc3MuZW52LlNRU19VUkwgfHwgXCJcIjtcblxuZXhwb3J0IGNvbnN0IGhhbmRsZXIgPSBhc3luYyAoZXZlbnQ6IGFueSA9IHt9KTogUHJvbWlzZTxhbnk+ID0+IHtcbiAgY29uc29sZS5sb2coXCJBREQgVE8gUVVFVUVcIik7XG4gIGNvbnNvbGUubG9nKFwiU05TX1RPUElDX0FSTlwiKTtcbiAgY29uc29sZS5sb2coU05TX1RPUElDX0FSTik7XG4gIGNvbnNvbGUubG9nKFwiU05TX1JPTEVfQVJOXCIpO1xuICBjb25zb2xlLmxvZyhTTlNfUk9MRV9BUk4pO1xuICBjb25zb2xlLmxvZyhcIlNRU19VUkxcIik7XG4gIGNvbnNvbGUubG9nKFNRU19VUkwpO1xuICBjb25zb2xlLmxvZyhKU09OLnN0cmluZ2lmeShldmVudCwgbnVsbCwgNCkpO1xuXG4gIC8vIFB1bGxzIGZpbGVuYW1lIGZyb20gZXZlbnRcbiAgY29uc3QgZmlsZW5hbWUgPSBldmVudFtcIlJlY29yZHNcIl1bMF1bXCJzM1wiXVtcIm9iamVjdFwiXVtcImtleVwiXTtcblxuICAvLyBTaG9ydC1jaXJjdWl0IGlmIGZpbGVuYW1lIGlzbid0IGRlZmluZWRcbiAgaWYgKCFmaWxlbmFtZSkge1xuICAgIGNvbnNvbGUubG9nKFwiRVJST1IgLSBmaWxlbmFtZVwiKTtcbiAgfVxuXG4gIGNvbnNvbGUubG9nKFwiZmlsZW5hbWU6IFwiICsgZmlsZW5hbWUpO1xuXG4gIC8vIC8vIERlZmluZXMgcGFyYW1zIGZvciBUZXh0cmFjdCBBUEkgY2FsbFxuICAvLyBjb25zdCB0ZXh0cmFjdFBhcmFtczogQVdTLlRleHRyYWN0LkFuYWx5emVEb2N1bWVudFJlcXVlc3QgPSB7XG4gIC8vICAgRG9jdW1lbnQ6IHtcbiAgLy8gICAgIFMzT2JqZWN0OiB7XG4gIC8vICAgICAgIEJ1Y2tldDogUzNfQlVDS0VUX05BTUUsXG4gIC8vICAgICAgIE5hbWU6IGZpbGVuYW1lXG4gIC8vICAgICAgIC8vIFZlcnNpb246IFwiU1RSSU5HX1ZBTFVFXCJcbiAgLy8gICAgIH1cbiAgLy8gICB9LFxuICAvLyAgIEZlYXR1cmVUeXBlczogW1wiVEFCTEVTXCIsIFwiRk9STVNcIl1cbiAgLy8gfTtcblxuICAvLyBjb25zb2xlLmxvZyhcInRleHRyYWN0UGFyYW1zXCIpO1xuICAvLyBjb25zb2xlLmxvZyh0ZXh0cmFjdFBhcmFtcyk7XG5cbiAgLy8gLy8gLy8gLy9cbiAgLy8gLy8gLy8gLy9cblxuICB2YXIgcGFyYW1zID0ge1xuICAgIERvY3VtZW50TG9jYXRpb246IHtcbiAgICAgIFMzT2JqZWN0OiB7XG4gICAgICAgIEJ1Y2tldDogUzNfQlVDS0VUX05BTUUsXG4gICAgICAgIE5hbWU6IGZpbGVuYW1lXG4gICAgICAgIC8vIFZlcnNpb246IFwiU1RSSU5HX1ZBTFVFXCJcbiAgICAgIH1cbiAgICB9LFxuICAgIC8vIENsaWVudFJlcXVlc3RUb2tlbjogZmlsZW5hbWUsXG4gICAgLy8gSm9iVGFnOiBcIkZPUk1fMDRcIixcbiAgICBOb3RpZmljYXRpb25DaGFubmVsOiB7XG4gICAgICBSb2xlQXJuOiBTTlNfUk9MRV9BUk4sXG4gICAgICBTTlNUb3BpY0FybjogU05TX1RPUElDX0FSTlxuICAgIH1cbiAgfTtcblxuICBjb25zb2xlLmxvZyhcInBhcmFtc1wiKTtcbiAgY29uc29sZS5sb2cocGFyYW1zKTtcblxuICBhd2FpdCBuZXcgUHJvbWlzZShyZXNvbHZlID0+IHtcbiAgICByZXR1cm4gdGV4dHJhY3Quc3RhcnREb2N1bWVudFRleHREZXRlY3Rpb24ocGFyYW1zLCBmdW5jdGlvbihlcnIsIGRhdGEpIHtcbiAgICAgIC8vIGlmIChlcnIpIGNvbnNvbGUubG9nKGVyciwgZXJyLnN0YWNrKTtcbiAgICAgIC8vIGFuIGVycm9yIG9jY3VycmVkXG4gICAgICAvLyBlbHNlIGNvbnNvbGUubG9nKGRhdGEpOyAvLyBzdWNjZXNzZnVsIHJlc3BvbnNlXG4gICAgICBjb25zb2xlLmxvZyhcIlNUQVJUIERPQ1VNRU5UIFRFWFQgREVURUNUSU9OXCIpO1xuICAgICAgY29uc29sZS5sb2coXCJlcnJcIik7XG4gICAgICBjb25zb2xlLmxvZyhlcnIpO1xuICAgICAgY29uc29sZS5sb2coXCJkYXRhXCIpO1xuICAgICAgY29uc29sZS5sb2coZGF0YSk7XG4gICAgICByZXNvbHZlKGRhdGEpO1xuICAgIH0pO1xuICB9KTtcblxuICBjb25zb2xlLmxvZyhcIkZ1bmN0aW9uIHNodXQgZG93blwiKTtcbiAgcmV0dXJuO1xuXG4gIC8vIC8vIC8vIC8vXG4gIC8vIC8vIC8vIC8vXG4gIC8vIFNRUyBDb2RlXG4gIC8vXG4gIC8vIGNvbnN0IHNxcyA9IG5ldyBBV1MuU1FTKHsgZW5kcG9pbnQ6IFNRU19VUkwsIHJlZ2lvbjogXCJ1cy13ZXN0LTJcIiAgfSk7XG4gIC8vIHZhciBwYXJhbXM6IEFXUy5TUVMuU2VuZE1lc3NhZ2VSZXF1ZXN0ID0ge1xuICAvLyAgIE1lc3NhZ2VCb2R5OiBKU09OLnN0cmluZ2lmeSh7IHRleHQ6IFwiTXkgVGV4dCBIZXJlXCIgfSksXG4gIC8vICAgUXVldWVVcmw6IFNRU19VUkwsXG4gIC8vICAgTWVzc2FnZUF0dHJpYnV0ZXM6IHtcbiAgLy8gICAgIG5hbWU6IHtcbiAgLy8gICAgICAgU3RyaW5nVmFsdWU6IFwiUmVxdWVzdCBOYW1lIEhlcmUhXCIsXG4gIC8vICAgICAgIERhdGFUeXBlOiBcIlN0cmluZ1wiXG4gIC8vICAgICB9XG4gIC8vICAgfVxuICAvLyAgIC8vIE1lc3NhZ2VHcm91cElkOiBcIlRlc3RNZXNzYWdlR3JvdXBcIlxuICAvLyB9O1xuXG4gIC8vIFNFTkRTIE1FU1NBR0UgT04gUVVFVUVcbiAgLy8gYXdhaXQgbmV3IFByb21pc2UocmVzb2x2ZSA9PiB7XG4gIC8vICAgc3FzLnNlbmRNZXNzYWdlKHBhcmFtcywgZnVuY3Rpb24oZXJyLCBkYXRhKSB7XG4gIC8vICAgICBjb25zb2xlLmxvZyhcIlNFTkQgTUVTU0FHRVwiKTtcbiAgLy8gICAgIGNvbnNvbGUubG9nKGVycik7XG4gIC8vICAgICBjb25zb2xlLmxvZyhkYXRhKTtcbiAgLy8gICAgIHJlc29sdmUoZGF0YSk7XG5cbiAgLy8gICAgIC8vIGlmIChlcnIpIGNvbnNvbGUubG9nKGVyciwgZXJyLnN0YWNrKTtcbiAgLy8gICAgIC8vIC8vIGFuIGVycm9yIG9jY3VycmVkXG4gIC8vICAgICAvLyBlbHNlIGNvbnNvbGUubG9nKGRhdGEpOyAvLyBzdWNjZXNzZnVsIHJlc3BvbnNlXG4gIC8vICAgfSk7XG4gIC8vIH0pO1xuICAvL1xuICAvLyAvLyAvLyAvL1xuICAvLyAvLyAvLyAvL1xuXG4gIC8vIERldGVjdCB0aGUgZG9jdW1lbnQncyB0ZXh0IHdpdGggVGV4dHJhY3RcbiAgLy8gYXdhaXQgbmV3IFByb21pc2UocmVzb2x2ZSA9PiB7XG4gIC8vICAgdGV4dHJhY3Quc3RhcnREb2N1bWVudFRleHREZXRlY3Rpb24oXG4gIC8vICAgICB0ZXh0cmFjdFBhcmFtcyxcbiAgLy8gICAgIGFzeW5jIChlcnI6IGFueSwgZGF0YTogYW55KSA9PiB7XG4gIC8vICAgICAgIGNvbnNvbGUubG9nKFwiRE9ORSBBTkFMWVpJTkcgRE9DVU1FTlRcIik7XG4gIC8vICAgICAgIGNvbnNvbGUubG9nKGVycik7XG4gIC8vICAgICAgIGNvbnNvbGUubG9nKGRhdGEpO1xuXG4gIC8vICAgICAgIGlmIChlcnIpIHtcbiAgLy8gICAgICAgICBjb25zb2xlLmxvZyhlcnIsIGVyci5zdGFjayk7XG4gIC8vICAgICAgICAgcmV0dXJuO1xuICAvLyAgICAgICB9XG5cbiAgLy8gICAgICAgLy8gRGVidWcgVGV4dHJhY3QgcmVzcG9uc2VcbiAgLy8gICAgICAgY29uc29sZS5sb2coXCJUZXh0cmFjdCBSZXNwb25zZVwiKTtcbiAgLy8gICAgICAgY29uc29sZS5sb2coSlNPTi5zdHJpbmdpZnkoZGF0YSwgbnVsbCwgNCkpO1xuXG4gIC8vICAgICAgIC8vIERlZmluZXMgdGhlIGl0ZW0gd2UncmUgaW5zZXJ0aW5nIGludG8gdGhlIGRhdGFiYXNlXG4gIC8vICAgICAgIGNvbnN0IGl0ZW06IGFueSA9IHtcbiAgLy8gICAgICAgICBbUFJJTUFSWV9LRVldOiBmaWxlbmFtZS5yZXBsYWNlKFwiLnBkZlwiLCBcIlwiKSxcbiAgLy8gICAgICAgICAvLyBwcmltYXJ5X2NvbnRhY3RfbmFtZTogXCJKb2huIERvZVwiXG4gIC8vICAgICAgICAgZGF0YToge1xuICAvLyAgICAgICAgICAgLi4uZGF0YVxuICAvLyAgICAgICAgIH1cbiAgLy8gICAgICAgfTtcblxuICAvLyAgICAgICAvLyBEZWZpbmVzIHRoZSBwYXJhbXMgZm9yIGRiLnB1dFxuICAvLyAgICAgICBjb25zdCBkeW5hbW9QYXJhbXMgPSB7XG4gIC8vICAgICAgICAgVGFibGVOYW1lOiBUQUJMRV9OQU1FLFxuICAvLyAgICAgICAgIEl0ZW06IGl0ZW1cbiAgLy8gICAgICAgfTtcblxuICAvLyAgICAgICAvLyBJbnNlcnRzIHRoZSByZWNvcmQgaW50byB0aGUgRHluYW1vREIgdGFibGVcbiAgLy8gICAgICAgYXdhaXQgZGIucHV0KGR5bmFtb1BhcmFtcykucHJvbWlzZSgpO1xuICAvLyAgICAgICByZXR1cm4gcmVzb2x2ZSgpO1xuICAvLyAgICAgfVxuICAvLyAgICk7XG4gIC8vIH0pO1xuXG4gIC8vIHJldHVybjtcblxuICAvLyAvLyAvLyAvL1xuICAvLyAvLyAvLyAvL1xuICAvLyAvLyAvLyAvL1xuICAvLyAvLyAvLyAvL1xuXG4gIC8vIERlZmluZXMgdGhlIGl0ZW0gd2UncmUgaW5zZXJ0aW5nIGludG8gdGhlIGRhdGFiYXNlXG4gIC8vIGNvbnN0IGl0ZW06IGFueSA9IHtcbiAgLy8gICBbUFJJTUFSWV9LRVldOiBNYXRoLnJhbmRvbSgpLnRvU3RyaW5nKCksXG4gIC8vICAgcHJpbWFyeV9jb250YWN0X25hbWU6IFwiSm9obiBEb2VcIlxuICAvLyB9O1xuXG4gIC8vIC8vIERlZmluZXMgdGhlIHBhcmFtcyBmb3IgZGIucHV0XG4gIC8vIGNvbnN0IGR5bmFtb1BhcmFtcyA9IHtcbiAgLy8gICBUYWJsZU5hbWU6IFRBQkxFX05BTUUsXG4gIC8vICAgSXRlbTogaXRlbVxuICAvLyB9O1xuXG4gIC8vIC8vIEluc2VydHMgdGhlIHJlY29yZCBpbnRvIHRoZSBEeW5hbW9EQiB0YWJsZVxuICAvLyByZXR1cm4gZGIucHV0KGR5bmFtb1BhcmFtcykucHJvbWlzZSgpO1xufTtcbiJdfQ==