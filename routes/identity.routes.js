import { Router } from "express";
import { IdentityController } from "../controllers/identity.controller.js   ";

const route = Router();

route.post('/',IdentityController);

export default route;
