/* eslint-disable max-len */
/* eslint-disable @typescript-eslint/no-misused-promises */
/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable @typescript-eslint/no-unsafe-call */
import { Request, Response, Router } from 'express';
import mongoose from 'mongoose'
import { User, StudentModel, FacultyModel, Student, Faculty } from "../schema/User";
import * as CryptoJS from "crypto-js";
require('dotenv').config();






const router = Router();

router.get('/open-to-work-student-list', async (req: Request, res: Response) => {
    const studentList = await StudentModel.find({status: 'accepted'}).exec();
    const idList = studentList.map(student => student.studentId);
    console.log("open to work list", idList);
    res.json(idList);
})

router.post('/update-student-status', async (req: Request, res: Response) => {
    const {studentId, status} = req.body as unknown as {studentId: string, status: 'paired' | 'accepted'};
    console.log('incoming request body ',req.body);
    const updatedStudent = await StudentModel.findOneAndUpdate({studentId}, {status}, {new: true}).exec();
    console.log('newly update is ', updatedStudent?.status);
    res.end();
})


export default router;