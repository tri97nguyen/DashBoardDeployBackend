/* eslint-disable @typescript-eslint/no-empty-function */
/* eslint-disable @typescript-eslint/restrict-template-expressions */
/* eslint-disable @typescript-eslint/no-unnecessary-type-assertion */
/* eslint-disable prefer-const */
/* eslint-disable @typescript-eslint/no-misused-promises */
/* eslint-disable max-len */
/* eslint-disable @typescript-eslint/no-unsafe-call */
import { Request, Response, Router } from 'express';
import { User, StudentModel, FacultyModel, Student, Faculty } from "../schema/User";
import { frontendUrl, systemEmail, defaultAESKey } from "../config";
// import * as CryptoJS from "crypto-js";
import CryptoJS = require('crypto-js');
// eslint-disable-next-line @typescript-eslint/no-unsafe-call

import dotenv = require('dotenv');
dotenv.config();
import sgMail from '@sendgrid/mail';
// eslint-disable-next-line @typescript-eslint/no-unsafe-call
sgMail.setApiKey(process.env.SENDGRID_API_KEY);
const PASSWORD_AES_PUBLIC_KEY = process.env.PASSWORD_AES_PUBLIC_KEY ?? defaultAESKey;



const router = Router();

router.get('/pending-user-list',  (req: Request, res: Response) => {
    StudentModel.find({}).then(data => res.json(data))
})

router.post('/pending-user-list', (req: Request, res: Response) => {
    const studentArray = req.body as unknown as Student[];
    studentArray.forEach(student => console.log(`receiving`,student.email));
    const promiseArray: any = [];
    studentArray.forEach(({email, status}: Student) => {
        const promise = StudentModel.updateOne({email}, {status}).exec();
        promiseArray.push(promise);
    });
    Promise.all(promiseArray).then(() => res.json({message: 'success'}));
    studentArray.filter(student => student.status == 'accepted' || student.status == 'denied').forEach(({email, status}) => {
        console.log('sending email to', email);
        sendEmail(email, status);
    });
        

})

router.get('/pending-faculty-list', (req: Request, res: Response) => {
    FacultyModel.find({}).then(data => res.json(data))
})

router.post('/pending-faculty-list', (req: Request, res: Response) => {
    const facultyArray = req.body as unknown as Faculty[];
    const activeAdminList = facultyArray.filter((faculty: Faculty) => faculty.isAdmin)
    if (activeAdminList.length == 0) res.json({message: "INVALID"})
    const promiseArray: Promise<any>[] = [];
    facultyArray.forEach(({_id, isAdmin}: Faculty) => {
        console.log("to be updated is ", _id);
        const promise = FacultyModel.findByIdAndUpdate(_id, {isAdmin}).exec();
        promiseArray.push(promise);
    })
    Promise.all(promiseArray).then(() => {
        console.log("updated faculty array", promiseArray);
        res.json({message: 'success'})
    });
})

router.post('/login', async (req: Request, res: Response) => {
    const {email, password} = req.body as unknown as Student | Faculty;
    if((req.body as any).email.includes('@ccsu.edu')){
        const doc = await loginAsRole(FacultyModel, email) as Faculty | null;
        if (!doc) res.json({message: "email not existed"});
        else { 
            console.log(doc);
            // hash user input password and compare to hashed store in db
            const decrypt = CryptoJS.AES.decrypt(doc.password.trim(), PASSWORD_AES_PUBLIC_KEY.trim()).toString(CryptoJS.enc.Utf8);
            console.log(`faculty is logging in with input pwd ${password}, decrypt pwd is ${decrypt}`);
            if (decrypt != password) res.json({message: "password incorrect"});
            else {
                let responseMessage = {message: 'success', userType: '', credentials: doc};
                if (doc.isAdmin) responseMessage.userType = 'admin';
                else responseMessage.userType = 'faculty';
                res.json(responseMessage);
            }

        }
        
    }
    else{
        const doc = await loginAsRole(StudentModel, email) as Student | null;
        if (!doc) res.json({message: "email not existed"});
        else {
            // hash user input password and compare to hashed store in db
            const decrypt = CryptoJS.AES.decrypt(doc.password.trim(), PASSWORD_AES_PUBLIC_KEY.trim()).toString(CryptoJS.enc.Utf8);
            if (decrypt != password) res.json({message: "password incorrect"});
            else {
                let responseMessage = {message: 'success', userType: '', credentials: doc};
                responseMessage.userType = 'student';
                res.json(responseMessage);
            }
        }
    }

    function loginAsRole(roleModel: typeof StudentModel | typeof FacultyModel, email: string) {
        return roleModel.findOne({email}).exec();
    } 
    
})

router.post('/request-change-password', async (req: Request, res: Response) => {
    const email = (req.body as any).email as string; // retrieve the email
    const studentDoc = await StudentModel.findOne({email}).exec(); // either studentdoc or facultydoc is null
    const facultyDoc = await FacultyModel.findOne({email}).exec();
    const doc = studentDoc ?? facultyDoc;
    if (doc == null) { // if both studentDoc and facultyDoc are null, then it's a boggus email => do nothing
        res.end();
        return;
    }
    // now invoke sendgrid to send email
    const message = `
    click this <a href=${frontendUrl}change-password?userId=${doc._id}>link</a> to change your password. If you didn't request a password change, please ignore this email
    `
    const msg = {
        to: email,
        from: systemEmail, // Use the email address or domain you verified above
        subject: 'CCSU Career Success Center Change Password Request',
        html: message,
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
    res.end();
})

router.post('/change-password', async (req: Request, res: Response) => {
    const {userId, password} = req.body as unknown as {userId: string, password: string};
    const encPassword = CryptoJS.AES.encrypt(password.trim(), PASSWORD_AES_PUBLIC_KEY.trim()).toString();
    const student = await StudentModel.findByIdAndUpdate(userId, {password: encPassword}, {new: true}).exec();
    if (student) {
        const decrypt = CryptoJS.AES.decrypt(student.password.trim(), PASSWORD_AES_PUBLIC_KEY.trim()).toString(CryptoJS.enc.Utf8);
        console.log("student is updated, new password is", decrypt);
        res.json(); // finish the request becuz we found a matching student doc and updated it
        return;
    }
    // otherwise if student is null, then userId is not in the student collection
    // so we need to continue looking in the faculty collection
    const faculty = await FacultyModel.findByIdAndUpdate(userId, {password: encPassword}, {new: true}).exec();
    if (faculty) {
        const decrypt = CryptoJS.AES.decrypt(faculty.password.trim(), PASSWORD_AES_PUBLIC_KEY.trim()).toString(CryptoJS.enc.Utf8);
        console.log("faculty is updated, new password is", decrypt);
        console.log(faculty);
        res.json(); 
    }

})



async function sendEmail(email: string, status: "accepted" | "denied" | "pending" | "paired") {
    // query db for email to get the password
    // send the password and username (email) in the message
    let doc = await StudentModel.findOne({email}).exec() as Student;
    const encryptedPwd = doc.password;
    console.log("encrypted password is ", encryptedPwd);
    const decryptedPwd = CryptoJS.AES.decrypt(encryptedPwd.trim(), PASSWORD_AES_PUBLIC_KEY.trim()).toString(CryptoJS.enc.Utf8);
    console.log("decrypt pwd", decryptedPwd);
    // TODO security
    // generate a session number => put it in the url param. 10mins
    // on the frontend, will send the new password along with this session number.
    // on the backend, validate if session number is valid and within valid interval

    const acceptedMessage = `
    <html>
        <h1>Congrats! You are verified</h1><br/><br/>

        Your new password is ${decryptedPwd}. To change your password, <a href=${frontendUrl}change-password?userId=${doc._id}>click here</a> <br/><br/>


    </html>
    `

    const deniedMessage = `
    <html>
        <h1>We are sorry to say you are not eligible to use the system. You are not work study student </h1><br/><br/>

    </html>
    `
    
    

    if (status != 'pending') {

        const msg = {
            to: email,
            from: systemEmail, // Use the email address or domain you verified above
            subject: 'Work Study Eligibility Status',
            html: status == 'accepted' ? acceptedMessage : deniedMessage,
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
    
    
}



export default router;