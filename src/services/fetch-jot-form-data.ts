/* eslint-disable @typescript-eslint/restrict-template-expressions */
/* eslint-disable @typescript-eslint/no-extra-semi */
/* eslint-disable @typescript-eslint/no-empty-function */
/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable @typescript-eslint/no-misused-promises */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable max-len */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable no-var */
/* eslint-disable @typescript-eslint/no-var-requires */
var fetch = require('node-fetch')
import { Request, Response, Router } from 'express';
import { User, StudentModel, FacultyModel, Student, Faculty } from "../schema/User";
import * as CryptoJS from "crypto-js";
import pwdGenerator from 'generate-password';
import {defaultAESKey, fetchJotFormDataInterval, frontendUrl, systemEmail} from '../config'
import { Mongoose } from 'mongoose';
const sgMail = require('@sendgrid/mail');
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const PASSWORD_AES_PUBLIC_KEY = process.env.PASSWORD_AES_PUBLIC_KEY ?? defaultAESKey;
const JOTFORM_API_KEY = process.env.JOTFORMAPIKEY
const FACULTY_FORM = `https://api.jotform.com/form/210495051819052/submissions?apiKey=${JOTFORM_API_KEY}`
const STUDENT_FORM = "https://api.jotform.com/form/210494933592058/submissions?apiKey=A38e131175f2cbd46596aec4e83fcab8"

async function fetchFacultyInfoJotFormData() {
    var resBack = await fetch(FACULTY_FORM);
    var data = await resBack.json();
    data = data.content.map((datum:any) => datum.answers)
    const facultyInfoArray: Faculty[] = data.map((row:any) => ({firstName: row[3].answer, lastName: row[4].answer, email: row[15].answer}))
    facultyInfoArray.forEach((faculty:Faculty) => {
        FacultyModel.findOne({email: faculty.email}).then(doc => {
            if (!doc) {
                console.log("new faculty is created", faculty.firstName);
                const password = pwdGenerator.generate({length: 10, numbers: true});
                const encryptedPassword = CryptoJS.AES.encrypt(password.trim(), PASSWORD_AES_PUBLIC_KEY.trim()).toString();
                const newFaculty = new FacultyModel({...faculty, password: encryptedPassword}); 
                newFaculty.save()
                    .then(fac => {
                        sendEmail(fac.email, password, fac._id);
                        console.log("new faculty is created", fac.firstName)
                    })
                    .catch((err: Error) => console.error(err));
            }
        })
    })
}

async function fetchStudentInfoJotFormData() {
    var resBack = await fetch(STUDENT_FORM);
    var data = await resBack.json();
    data = data.content.map((datum:any) => datum.answers)
    const studentInfoArray: Student[] = data.map((row:any) => ({firstName: row[2].answer, lastName: row[3].answer, studentId: row[4].answer, email: row[6].answer}));
    studentInfoArray.forEach((student: Student) => {
        StudentModel.findOne({email: student.email}).then(doc => {
            if (!doc) {
                console.log("new student is created", student.firstName);
                const password = pwdGenerator.generate({length: 10, numbers: true});
                const encryptedPassword = CryptoJS.AES.encrypt(password.trim(), PASSWORD_AES_PUBLIC_KEY.trim()).toString();
                const newStudent = new StudentModel({...student, password: encryptedPassword}); 
                newStudent.save()
                    .then(std => console.log("new student is created", std.firstName))
                    .catch((err: Error) => console.error(err));
            }
        })
    })
}

export const router = Router();

export function listenForNewFaculty() {
    console.log("faculty service running")
    if (fetchJotFormDataInterval < 60000) console.warn('fetchJotFormDataInterval should be more than 60000 (10 minutes) to prevent exhausting API usage limit');
    else setInterval(fetchFacultyInfoJotFormData, fetchJotFormDataInterval);
};

export function listenForNewStudent() {
    console.log("student service running")
    if (fetchJotFormDataInterval < 60000) console.warn('fetchJotFormDataInterval should be more than 60000 (10 minutes) to prevent exhausting API usage limit');
    else setInterval(fetchStudentInfoJotFormData, fetchJotFormDataInterval);

}

async function sendEmail(email: string, password: string, docId: string) {
    const acceptedMessage = `
    <html>
        Your new password is ${password}. To change your password, <a href=${frontendUrl}change-password?userId=${docId}>click here</a> <br/><br/>
    </html>
    `
    const msg = {
        to: email,
        from: systemEmail, // Use the email address or domain you verified above
        subject: 'Career Success Center: Faculty account created',
        html: acceptedMessage,
        };
        //ES6
        sgMail
        .send(msg)
        .then(() => {}, (error: any) => {
            console.error(error);
        
            if (error.response) {
            console.error(error.response.body)
            }
        });
    }
    
    
