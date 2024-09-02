import { Collection } from "discord.js";

/**
 * Represents a single section of a particular course listing.
 */
export type CourseSection = {
    /** The instructor's full name, or "TBD" if not yet known. */
    instructor: string,
    /** The maximum enrollment capacity. */
    max: number,
    /** The current enrollment count. */
    curr: number,
    /** The size of the waitlist queue. Can be 0 if nobody is in the waitlist. */
    waitlist: number
};

/**
 * Represents a course listing.
 * 
 * Courses can be uniquely indexed by their ID (assuming it exists), or their code and session.
 */
export class Course {
    /** (Optional) A long unique hash. */
    id: string | null
    /** The 8-9 digit course code. (e.g. CSC108H1, CSCC69H3, CSC2530H1) */
    code: string
    /** A human-readable session name. (e.g. Winter 2021, Fall-Winter 2021-2022, Summer First Half 2022) */
    session: string
    /** A single-character code indicating the session portion. Can be F, S, or Y. */
    sectionCode: string
    /** A human-readable course title. (e.g. Introduction to Computer Programming) */
    title: string
    /** (Optional) A map of the course's sections, indexed by a section code (not to be confused with the sectionCode field, e.g. LEC0101, TUT0201) */
    sections: Collection<string, CourseSection> | null

    constructor(id: string | null, code: string, session: string, sectionCode: string, title: string, sections: Collection<string, CourseSection> | null) {
        this.id = id;
        this.code = code;
        this.session = session;
        this.sectionCode = sectionCode;
        this.title = title;
        this.sections = sections;
    }
};

export class TimestampedCourse extends Course implements Timestamped {
    /** The timestamp of the course, in unix milliseconds. */
    timestamp: number

    constructor(id: string | null, code: string, session: string, sectionCode: string, title: string, sections: Collection<string, CourseSection> | null, timestamp: number) {
        super(id, code, session, sectionCode, title, sections);
        this.timestamp = timestamp;
    }
}

/**
 * A generic value which has a timestamp associated with it.
 */
export interface Timestamped {
    /** The timestamp of the value, in unix milliseconds. */
    timestamp: number
};