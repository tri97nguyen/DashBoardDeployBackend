/* eslint-disable @typescript-eslint/no-empty-function */
/* eslint-disable max-len */
/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable @typescript-eslint/no-unsafe-call */
import { Request, Response, Router } from 'express';
import { StudentModel, FacultyModel } from "../schema/User";
import { frontendUrl, systemEmail, remindEmailInterval } from "../config";
require('dotenv').config();
const sgMail = require('@sendgrid/mail');
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const router = Router();
const intervalIds: {facultyEmail: string, studentId: string, intervalId: NodeJS.Timeout}[]= [];
type FollowUp = {student: {studentId: string, status: 'paired' | 'accepted'}, facultyEmail: string}
router.post('/update-follow-up', (req: Request, res: Response) => {
  console.log(req.body);
  const response = req.body as unknown as FollowUp;
  removeStudentFromContactedList(response.student.studentId, response.facultyEmail);
  let intervalIndex = -1;
  const interval = intervalIds.filter((int, index) => {
    const predicate = int.facultyEmail == response.facultyEmail && int.studentId == response.student.studentId;
    if (predicate) intervalIndex = index;
    console.log('index is ', intervalIndex);
    return predicate;
  });
  if (intervalIndex == -1) throw 'no email bot in queue';
  intervalIds.splice(intervalIndex, 1);
  clearInterval(interval[0].intervalId);
  res.json();
})

function removeStudentFromContactedList(studentId: string, facultyEmail: string){
  console.log('studentid is ', studentId);
  console.log('facultyEmail is ',facultyEmail);
  FacultyModel.findOneAndUpdate({email: facultyEmail}, {$pull : {contactedStudents: studentId}}, {new: true}).then(doc => console.log('updated faculty is ', doc))

} 

type sendEmailToStudentResponse = {student: {firstname: string, lastname: string, ccsuId: string, major: string, email: string}, faculty: {firstname: string, lastname: string, email: string}}
router.post('/send-email-to-student', (req: Request, res: Response) => {
    console.log(req.body);
    const response = req.body as unknown as sendEmailToStudentResponse;
    sendResponse(response);
    updateFacultyStudentContactList(response.faculty.email, response.student.ccsuId, res);
    invokeSendEmailBot(response);
    res.json();
})


function updateFacultyStudentContactList(email: string, studentId: string, res: Response) {
    FacultyModel.findOneAndUpdate({email}, {'$push': {"contactedStudents": studentId}}, {new: true})
        .then(doc => {
            console.log("updated doc is ", doc);
        })
        
}

function scheduleFollowUpEmail(res: sendEmailToStudentResponse) {
    const emailBody = 
    `
    Dear professor ${res.faculty.lastname},<br/><br/>

    Do you want to hire ${res.student.firstname} ${res.student.lastname} at ${res.student.email} for your position through the CCSU Career Success Center?<br/><br/>

    This message is sent every 3 days until you update your hiring status.<br/>

    <a href="${frontendUrl}update-follow-up?ccsuId=${res.student.ccsuId}&facultyEmail=${res.faculty.email}">Update my hiring status</a>
    <br/><br/>

    This is an automated message. Please do NOT reply to this email.
    `
    // SendGrid only allows scheduling email up to 72 in advance
    // const threeDaysLater = new Date();
    // // threeDaysLater.setHours(threeDaysLater.getHours() + 71); // take off 1 hour to ensure it is within 72 hours range
    // threeDaysLater.setSeconds(threeDaysLater.getSeconds() + 5); // delay 5 seconds. For testing purpose
    // const unixTimeStamp = parseInt((threeDaysLater.getTime() / 1000).toFixed(0))
    const msg = {
        to: res.faculty.email,
        cc: [systemEmail, 'ganton@my.ccsu.edu'],
        from: systemEmail, // Use the email address or domain you verified above
        subject: '[ACTION REQUIRED] Student Hiring Confirmation Request',
        html: emailBody,
        // send_at: unixTimeStamp,
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

function sendResponse(response: sendEmailToStudentResponse) {
    const msg = {
        to: response.student.email,
        from: systemEmail,
        cc: [response.faculty.email, 'ganton@my.ccsu.edu',systemEmail],
        subject: 'CCSU Career Success Center: You Are Wanted For A Work-Study Position!',
        html: `
        Dear ${response.student.firstname},<br/><br/>
        
        Please contact ${response.faculty.firstname} ${response.faculty.lastname} at ${response.faculty.email}
        for more information regarding this position.<br/><br/>

        CCSU Career Success Center<br/><br/>
        
        This is an automated email. Please do not reply to this email.
        ` 
    };

    sgMail
        .send(msg)
        .then(() => {}, (error: any) => {
            console.error(error);
            if (error.response) {
                console.error(error.response.body)
              }
        });
}

function invokeSendEmailBot(res: sendEmailToStudentResponse) {
  if (remindEmailInterval < 1800000) throw 'Remind Email Interval must not be too low (< 30 minutes)';
  scheduleFollowUpEmail(res) // send the first email;
  const intervalId = setInterval(() => scheduleFollowUpEmail(res), remindEmailInterval);   // schedule reminder email
  intervalIds.push({facultyEmail: res.faculty.email, studentId: res.student.ccsuId, intervalId})
}



export default router;