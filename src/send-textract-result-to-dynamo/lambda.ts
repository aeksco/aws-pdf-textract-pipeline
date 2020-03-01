import * as AWS from "aws-sdk";
const db = new AWS.DynamoDB.DocumentClient();
const textract = new AWS.Textract({ region: "us-west-2" });
const TABLE_NAME = process.env.TABLE_NAME || "";
const PRIMARY_KEY = process.env.PRIMARY_KEY || "";

// // // //

// DOC: https://docs.aws.amazon.com/textract/latest/dg/examples-extract-kvp.html
// DOC: https://docs.aws.amazon.com/textract/latest/dg/examples-export-table-csv.html
function find_value_block(key_block: any, value_map: any) {
  let value_block = "";
  key_block["Relationships"].forEach((relationship: any) => {
    if (relationship["Type"] == "VALUE") {
      relationship["Ids"].forEach((value_id: any) => {
        value_block = value_map[value_id];
      });
    }
  });
  return value_block;
}

// // // //

function get_text(result: any, blocks_map: any) {
  let text = "";
  let word;
  if (result["Relationships"]) {
    result["Relationships"].forEach((relationship: any) => {
      if (relationship["Type"] === "CHILD") {
        relationship["Ids"].forEach((child_id: any) => {
          word = blocks_map[child_id];

          if (word["BlockType"] == "WORD") {
            text += word["Text"] + " ";
          }
          if (word["BlockType"] == "SELECTION_ELEMENT") {
            if (word["SelectionStatus"] == "SELECTED") {
              text += "X ";
            }
          }
        });
      }
    });
  }
  return text;
}

// // // //

function getKvMap(resp: any) {
  // get key and value maps
  let key_map: any = {};
  let value_map: any = {};
  let block_map: any = {};

  resp["Blocks"].forEach((block: any) => {
    const block_id = block["Id"];
    block_map[block_id] = block;
    if (block["BlockType"] == "KEY_VALUE_SET") {
      if (block["EntityTypes"].includes("KEY")) {
        key_map[block_id] = block;
      } else {
        value_map[block_id] = block;
      }
    }
  });

  return [key_map, value_map, block_map];
}

// // // //

function getKvRelationship(keyMap: any, valueMap: any, blockMap: any) {
  let kvs: any = {};
  // for block_id, key_block in key_map.items():
  Object.keys(keyMap).forEach(blockId => {
    const keyBlock = keyMap[blockId];
    const value_block = find_value_block(keyBlock, valueMap);
    // console.log("value_block");

    // Gets Key + Value
    const key = get_text(keyBlock, blockMap);
    const val = get_text(value_block, blockMap);
    kvs[key] = val;
  });

  return kvs;
}

// // // //

/**
 * handler
 * Trims down result from Textract and sends to DynamoDB
 * @param event - AWS SNS event
 * Example `event` parameter:
 * {
 *   "Records": [
 *     {
 *       "EventSource": "aws:sns",
 *       "EventVersion": "1.0",
 *       "EventSubscriptionArn": "arn:aws:sns:us-west-2:839811712080:LambdaCronExample-MyTopic86869434-GNU4OYHJJK2B:2835b150-7b7c-4701-b345-1a26aa997ba0",
 *       "Sns": {
 *         "Type": "Notification",
 *         "MessageId": "a0fcdb52-33c5-5e75-a29d-8d9f16c6efa0",
 *         "TopicArn": "arn:aws:sns:us-west-2:839811712080:LambdaCronExample-MyTopic86869434-GNU4OYHJJK2B",
 *         "Subject": null,
 *         "Message": "{\"JobId\":\"8ace6713ef0f85fbd88294d4f50b5063ad08052f93da760e98da55668f3e1148\",\"Status\":\"SUCCEEDED\",\"API\":\"StartDocumentTextDetection\",\"Timestamp\":1582506691353,\"DocumentLocation\":{\"S3ObjectName\":\"5055255.pdf\",\"S3Bucket\":\"lambdacronexample-cogccpdfdownloadsbucket93b40e01-1kn95iu6zt174\"}}",
 *         "Timestamp": "2020-02-24T01:11:31.395Z",
 *         "SignatureVersion": "1",
 *         "Signature": "drLfHmCEegFSc4oLYO/5y8ouKkHQLEsDo2l9tFFFtUGTUcbnIhFHYvQfbTND9BxE8a18kZ+nDBHuLlNhF67oVW0B2I8oy3svlYc6oeRUcgg6wF8TqlPpBwsG+UCnP81OIjtcb0VutqeYonlg8EDuXYK/pPumDsQ1NIkKjfwncdLPJLsgiuZZOkkRnvui5qftLSRkXtI1EXdwhIIXNyU3jK0MhEWZ/69K2mpZRSkb1jy2nkfQi1zlhktF4AfQpq4bMVxaBTq36Hb4FXXpzcPO2CLN2XchAIszd4vDAiEy9oSKJIW0IxqY5bazk70/lCva+AaMHoUAUazHHXamOZC4nw==",
 *         "SigningCertUrl": "https://sns.us-west-2.amazonaws.com/SimpleNotificationService-a86cb10b4e1f29c941702d737128f7b6.pem",
 *         "UnsubscribeUrl": "https://sns.us-west-2.amazonaws.com/?Action=Unsubscribe&SubscriptionArn=arn:aws:sns:us-west-2:839811712080:LambdaCronExample-MyTopic86869434-GNU4OYHJJK2B:2835b150-7b7c-4701-b345-1a26aa997ba0",
 *         "MessageAttributes": {}
 *       }
 *     }
 *   ]
 * }
 */
export const handler = async (event: any = {}): Promise<any> => {
  // Logs starting message
  console.log("send-textract-result-to-dynamo - start");
  console.log(JSON.stringify(event, null, 4));

  // Defines variable to store JobId from Textract.analyzeDocument
  let JobId = "";

  // Attempt to parse the JobId from the `event` param
  try {
    JobId = event["Records"][0]["Sns"]["Message"];
    console.log("parsed jobid struct from event");
    console.log(JobId);
    console.log(JSON.parse(JobId));
    const jobIDStruct = JSON.parse(JobId);
    JobId = jobIDStruct["JobId"];
  } catch (e) {
    // Logs error message from
    console.log("Error parsing JobId from SNS message");
    console.log(e);
    return;
  }

  // Log JobID
  console.log("JobId");
  console.log(JobId);

  // Defines params for Textract.getDocumentAnalysis
  const getDocumentAnalysisParams: any = {
    JobId,
    MaxResults: 1
  };

  // Logs getDocumentAnalysis params
  console.log("getDocumentAnalysisParams");
  console.log(getDocumentAnalysisParams);

  // Fires off textract.getDocumentAnalysis
  await new Promise(resolve => {
    textract.getDocumentAnalysis(getDocumentAnalysisParams, async function(
      err: any,
      data: any
    ) {
      // Logs error response
      console.log("Textract - getDocumentAnalysis error");
      console.log(err);

      // Logs successful response
      console.log("Textract - getDocumentAnalysis data");
      console.log(data);

      // Gets KV mapping
      const [keyMap, valueMap, blockMap] = getKvMap(data);

      // Get Key Value relationship
      const kvPairs = getKvRelationship(keyMap, valueMap, blockMap);

      // Logs form key-value pairs from Textract response
      console.log("Got KV pairs");

      // Sanitize KV pairs
      const sanitizedKvPairs: { [key: string]: string } = {};

      // Iterate over each key in kvPairs
      Object.keys(kvPairs).forEach((key: string) => {
        // Sanitizes the key from kv pairs
        // DynamoDB key cannot contain any whitespace
        const sanitizedKey: string = key
          .toLowerCase()
          .trim()
          .replace(/\s/g, "_")
          .replace(":", "");

        // Pulls value from kbPairs, trims whitespace
        const value: string = kvPairs[key].trim();

        // Assigns value from kvPairs to sanitizedKey
        if (value !== "") {
          sanitizedKvPairs[sanitizedKey] = kvPairs[key];
        }
      });

      // Logs sanitized key-value pairs
      console.log("SanitizedKvPairs");
      console.log(sanitizedKvPairs);

      // Defines the item we're inserting into the database
      const item: any = {
        [PRIMARY_KEY]: JobId,
        data: sanitizedKvPairs
      };

      // Defines the params for db.put
      const dynamoParams = {
        TableName: TABLE_NAME,
        Item: item
      };

      // Logs DynamoDB params
      console.log("dynamoParams");
      console.log(dynamoParams);

      // Inserts the record into the DynamoDB table
      await db.put(dynamoParams).promise();

      // Logs shutdown message
      console.log("send-textract-result-to-dynamo - shutdown");

      // Resolves promise
      resolve(true);
    });
  });
};
