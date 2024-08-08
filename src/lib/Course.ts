import { Collection } from "discord.js";

export type CourseSection = {
    instructor: string,
    max: number,
    curr: number,
    waitlist: number
};

export type Course = {
    id: string | null,
    code: string,
    session: string,
    sectionCode: string,
    title: string,
    sections: Collection<string, CourseSection> | null
};

export type CachedCourse = {
    course: Course,
    lastUpdated: number
};