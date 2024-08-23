import { Collection } from "discord.js";

export type CourseSection = {
    instructor: string,
    max: number,
    curr: number,
    waitlist: number
};

/**
 * Represents a course listing.
 * 
 * Courses can be uniquely indexed by their ID (assuming it exists), or their code and session.
 */
export type Course = {
    /** (Optional) A long unique hash. */
    id: string | null,
    /** The 8-9 digit course code. (e.g. CSC108H1, CSCC69H3, CSC2530H1) */
    code: string,
    /** A human-readable session name. (e.g. Winter 2021, Fall-Winter 2021-2022, Summer First Half 2022) */
    session: string,
    /** A single-character code indicating the session portion. Can be F, S, or Y. */
    sectionCode: string,
    /** A human-readable course title. (e.g. Introduction to Computer Programming) */
    title: string,
    /** (Optional) A map of the course's sections, indexed by a section code (not to be confused with the sectionCode field, e.g. LEC0101, TUT0201) */
    sections: Collection<string, CourseSection> | null
};

/**
 * A generic value which has a timestamp associated with it.
 */
export interface Timestamped<T> {
    /** The timestamp of the value, in unix milliseconds. */
    timestamp: number,
    /** The associated value. */
    value: T
};