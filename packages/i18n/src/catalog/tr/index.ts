import type { PartialCatalog } from "../../core";
import common from "./common";
import shell from "./shell";
import auth from "./auth";
import dashboard from "./dashboard";
import accounts from "./accounts";
import accountDetail from "./accountDetail";
import profile from "./profile";
import kyc from "./kyc";
import trader from "./trader";
import order from "./order";
import toolbox from "./toolbox";
import market from "./market";
import wallet from "./wallet";

const catalog: PartialCatalog = { common, shell, auth, dashboard, accounts, accountDetail, wallet, profile, kyc, trader, order, toolbox, market };
export default catalog;
