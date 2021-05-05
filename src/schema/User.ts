import mongoose, {Document, Schema} from "mongoose"

export interface User extends Document {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    phoneNumber?: string;
    
}

export interface Student extends User {
    studentId: string;
    status: 'accepted' | 'denied' | 'pending' | 'paired';
}

export interface Faculty extends User {
    isAdmin: boolean;
    contactedStudents: string[];
}

const studentSchema: Schema = new mongoose.Schema({
    email: String,
    password: String,
    firstName: String,
    lastName: String,
    studentId: String,
    status: {type: String, default: 'pending'}
}, {
    timestamps: {currentTime: () => Math.floor(Date.now() / 1000) }
})


const facultySchema: Schema = new mongoose.Schema({
    email: String,
    password: String,
    firstName: String,
    lastName: String,
    isAdmin: {type: Boolean, default: false},
    contactedStudents: []
}, {
    timestamps: {currentTime: () => Math.floor(Date.now() / 1000) }
})


export const StudentModel = mongoose.model<Student>("Student", studentSchema);
export const FacultyModel = mongoose.model<Faculty>("Faculty", facultySchema);