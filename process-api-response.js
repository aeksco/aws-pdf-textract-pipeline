// DOC: https://docs.aws.amazon.com/textract/latest/dg/examples-extract-kvp.html
// DOC: https://docs.aws.amazon.com/textract/latest/dg/examples-export-table-csv.html
const apiResponse = require("./data/apiResponse");
const fs = require("fs");

// // // //

// def find_value_block(key_block, value_map):
//     for relationship in key_block['Relationships']:
//         if relationship['Type'] == 'VALUE':
//             for value_id in relationship['Ids']:
//                 value_block = value_map[value_id]
//     return value_block

function find_value_block(key_block, value_map) {
  let value_block = "";
  key_block["Relationships"].forEach(relationship => {
    if (relationship["Type"] == "VALUE") {
      relationship["Ids"].forEach(value_id => {
        value_block = value_map[value_id];
      });
    }
  });
  return value_block;
}

// // // //

// def get_text(result, blocks_map):
//     text = ''
//     if 'Relationships' in result:
//         for relationship in result['Relationships']:
//             if relationship['Type'] == 'CHILD':
//                 for child_id in relationship['Ids']:
//                     word = blocks_map[child_id]
//                     if word['BlockType'] == 'WORD':
//                         text += word['Text'] + ' '
//                     if word['BlockType'] == 'SELECTION_ELEMENT':
//                         if word['SelectionStatus'] == 'SELECTED':
//                             text += 'X '
//     return text

// // // //

function get_text(result, blocks_map) {
  let text = "";
  let word;
  if (result["Relationships"]) {
    result["Relationships"].forEach(relationship => {
      if (relationship["Type"] === "CHILD") {
        relationship["Ids"].forEach(child_id => {
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

// def print_kvs(kvs):
//     for key, value in kvs.items():
//         print(key, ":", value)

// def search_value(kvs, search_key):
//     for key, value in kvs.items():
//         if re.search(search_key, key, re.IGNORECASE):
//             return value

// def main(file_name):

//     key_map, value_map, block_map = get_kv_map(file_name)

//     # Get Key Value relationship
//     kvs = get_kv_relationship(key_map, value_map, block_map)
//     print("\n\n== FOUND KEY : VALUE pairs ===\n")
//     print_kvs(kvs)

//     # Start searching a key value
//     while input('\n Do you want to search a value for a key? (enter "n" for exit) ') != 'n':
//         search_key = input('\n Enter a search key:')
//         print('The value is:', search_value(kvs, search_key))

// // // //

function getKvMap(resp) {
  console.log("Get KV Map");

  // get key and value maps
  let key_map = {};
  let value_map = {};
  let block_map = {};

  resp["Blocks"].forEach(block => {
    block_id = block["Id"];
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

function getKvRelationship(keyMap, valueMap, blockMap) {
  let kvs = {};
  // for block_id, key_block in key_map.items():
  Object.keys(keyMap).forEach(blockId => {
    keyBlock = keyMap[blockId];
    value_block = find_value_block(keyBlock, valueMap);
    // console.log("value_block");

    // Gets Key + Value
    key = get_text(keyBlock, blockMap);
    val = get_text(value_block, blockMap);
    kvs[key] = val;
  });

  return kvs;
}

// // // //

function handler() {
  console.log("Processing API response");

  // Gets KV mapping
  const [keyMap, valueMap, blockMap] = getKvMap(apiResponse);
  console.log("GOT RESPONSE");
  // console.log(Object.ke//ys(keyMap));
  // console.log(Object.keys(valueMap));
  // console.log(Object.keys(blockMap));

  // // // //

  // Get Key Value relationship
  kvs = getKvRelationship(keyMap, valueMap, blockMap);
  // print("\n\n== FOUND KEY : VALUE pairs ===\n");
  // console.log(kvs);

  // Writes processed data to file
  fs.writeFileSync(
    "./data/processed-api-response.json",
    JSON.stringify(kvs, null, 4)
  );
}

// // // //

// TODO - wire this up to the queueResult lambda before sending the data to DynamoDB
handler();
