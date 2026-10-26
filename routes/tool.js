import { Router } from "express";
import osmcalLoader from "../model/osmcalLoader.js";


import auth from "../routes/auth.js";


const router = Router();


function getEventTable(req, res, next) {
  const lang = req.query.lang;
  const blogStartDate = req.body.blogStartDate;
  osmcalLoader.getEventMdCb(lang, blogStartDate, function(err, result) {
    if (err) return next(err);
    return res.end(result);
  });
}

router.post("/getEventTable", auth.checkRole("full"), getEventTable);


export default router;
