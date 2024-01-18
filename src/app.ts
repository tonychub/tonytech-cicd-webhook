import moduleAlias from "module-alias";
moduleAlias.addAliases({
  "@": __dirname,
});
import { config } from "dotenv";
config();
import { getWebhookActionById } from "@/api/myApi";
import express, { Application, Request, Response } from "express";

import cors from "cors";
import { IWebhookAction } from "@/type/index";
import {
  PULLREQUEST_STATUS,
  RUN_ACTION_ERRORS,
  RUN_ACTION_SUCCESS,
} from "@/constants/index";
import { handleRunScript } from "@/handler/index";

const port = process.env.PORT || 9999;
const app: Application = express();
const name = process.env.MYNAME || "Kun";
app.use(cors());
app.use(express.json());

const checkPullRequestStatus = (body: any, webhookAction: IWebhookAction) => {
  const { listenType, from, to } = webhookAction;
  const conditionBranch = () => {
    if (from) {
      return (
        body.pull_request.head.ref === from && body.pull_request.base.ref === to
      );
    }
    return body.pull_request.base.ref === to;
  };
  if (conditionBranch()) {
    if (body.action === PULLREQUEST_STATUS.OPENED) {
      if (listenType === body.action) {
        return true;
      }
    } else if (body.action === PULLREQUEST_STATUS.CLOSED) {
      if (
        !body.pull_request.merged &&
        listenType === PULLREQUEST_STATUS.CLOSED
      ) {
        return true;
      }
      if (
        body.pull_request.merged &&
        listenType === PULLREQUEST_STATUS.MERGED
      ) {
        return true;
      }
    }
  }
  return false;
};

app.get("/", (_req: Request, res: Response) => {
  res.json({
    message: "Hello " + name,
  });
});
app.post("/webhook/:webhookActionId", async (req: Request, res: Response) => {
  try {
    const resWebhookAction = await getWebhookActionById(
      req.params.webhookActionId
    );

    const scriptIds = resWebhookAction.data.additionalScriptIds;
    const isAction = checkPullRequestStatus(req.body, resWebhookAction.data);

    if (isAction) {
      const status = await handleRunScript(resWebhookAction.data.scriptId);
      if (status === "error") {
        return res.status(RUN_ACTION_ERRORS.code).json({
          message: RUN_ACTION_ERRORS.msg,
        });
      }

      if (scriptIds.length > 0) {
        for (let index = 0; index < scriptIds.length; index++) {
          const statusAdditionalScript = await handleRunScript(
            scriptIds[index]
          );
          if (statusAdditionalScript === "error") {
            return res.status(RUN_ACTION_ERRORS.code).json({
              message: RUN_ACTION_ERRORS.msg,
            });
          }
        }
      }
      return res.json({
        message: RUN_ACTION_SUCCESS.msg,
      });
    } else {
      res.status(RUN_ACTION_ERRORS.code).json({
        message: RUN_ACTION_ERRORS.msg,
      });
    }
  } catch (error) {
    res.status(RUN_ACTION_ERRORS.code).json({
      message: RUN_ACTION_ERRORS.msg,
    });
  }
});
app.listen(port, () => {
  console.log(`⚡️[server]: Server is running at http://localhost:${port}`);
});
export default app;
