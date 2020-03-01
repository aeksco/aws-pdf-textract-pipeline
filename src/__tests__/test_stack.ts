import { expect as expectCDK, countResources } from "@aws-cdk/assert";
import * as cdk from "@aws-cdk/core";
import { PdfTextractPipeline } from "../stack";

// // // //

describe("PdfTextractPipeline", () => {
  test("loads", () => {
    const app = new cdk.App();

    // Configures CDK stack
    const stack: cdk.Stack = new PdfTextractPipeline(
      app,
      "PdfTextractPipeline"
    );

    // Checks stack resource count
    expectCDK(stack).to(countResources("AWS::DynamoDB::Table", 2));
    expectCDK(stack).to(countResources("AWS::Events::Rule", 1));
    expectCDK(stack).to(countResources("AWS::IAM::Policy", 6));
    expectCDK(stack).to(countResources("AWS::IAM::Role", 6));
    expectCDK(stack).to(countResources("AWS::Lambda::EventSourceMapping", 1));
    expectCDK(stack).to(countResources("AWS::Lambda::Function", 5));
    expectCDK(stack).to(countResources("AWS::Lambda::Permission", 3));
    expectCDK(stack).to(countResources("AWS::SNS::Subscription", 1));
    expectCDK(stack).to(countResources("AWS::SNS::Topic", 1));
    expectCDK(stack).to(countResources("Custom::S3BucketNotifications", 1));
  });
});
