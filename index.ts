import * as cdk from "@aws-cdk/core";
import { LambdaCronStack } from "./src/stack";

// // // //

// TODO - annotate this
const app = new cdk.App();
// TODO - rename this
new LambdaCronStack(app, "LambdaCronExample");
app.synth();
