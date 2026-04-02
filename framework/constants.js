export const dataRequiredActions = new Set([
    "clickPerticularJobTitle",
    "checkbox",
    "multiSelectCreate",
    "toggleState",
    "autocomplete",
    "editor",
    "date",
    "upload",
    "select",
    "input",

    "text",
    "contains",
    "arrayContains",
    "checkoruncheck",
    "toggleCheck",

    "timeDelay",
    "select",
    "saveJobID",


    "textContains",
    "textEquals",
    

    "openUrlNewTab",
    "openUrlNewWindow",
    "switchPage",
    "switchContextPage",
    "closePage",


    "getText",
    "addInArray",
    "addInArrayDirect",
    "clickInRow",
    "enterTextInRow",
    "listEqualsArray",
    "locatorCount",
]);

// for production only
// export const allureCmd = `"/xdata/qaautomation/autobots/framework/node_modules/allure-commandline/bin/allure"`;

export const allureCmd = `"${process.env.APPDATA}\\npm\\allure.cmd"`;


