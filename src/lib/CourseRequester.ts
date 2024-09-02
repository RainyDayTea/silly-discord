import axios, { AxiosRequestHeaders } from 'axios';
import { AxiosHeaders } from 'axios';
import { Collection } from 'discord.js';
import { Course, CourseSection, TimestampedCourse } from './Course';
import { Database } from 'sqlite3';

const BASE_URL: string = 'https://api.easi.utoronto.ca/ttb/getPageableCourses';
const HEADER: AxiosRequestHeaders = new AxiosHeaders({
    'Content-Type': 'application/json',
    'Accept': 'application/json',
});

/** Matches to course codes in a string. */
export const REGEX_CODE: RegExp = /(?<!\w)[a-z]{3}([a-d]\d{2}([h,y]3){0,1}|\d{3,4}([h,y][1,5]){0,1})(?!\w)/gmi;
/** Matches to course session keywords in a string. */
export const REGEX_SESSION: RegExp = /(?<!\w)(winter|summer|first|second|fall|year|f|s|y)(?!\w)/gmi;



// ===============[[ TYPES ]]================


export class CourseRequestBody {
    public courseCodeAndTitleProps: {
        courseCode: string,
        courseTitle: string,
        courseSectionCode: string,
        searchCourseDescription: boolean,
    };
    public courseSection: string;
    public departmentProps: Array<any>;
    public campuses: Array<string>;
    public sessions: Array<string>;
    public requirementProps: Array<any>;
    public instructor: string;
    public courseLevels: Array<string>;
    public deliveryModes: Array<string>;
    public dayPreferences: Array<string>;
    public timePreferences: Array<string>;
    public divisions: Array<string>;
    public creditWeights: Array<string>;
    public availableSpace: boolean;
    public page: number;
    public pageSize: number;
    public direction: string;

    constructor();
    constructor(c: CourseRequestBody);
    constructor(c?: CourseRequestBody) {
        this.courseCodeAndTitleProps = {
            courseCode: "",
            courseTitle: "",
            courseSectionCode: "",
            searchCourseDescription: true,
        };
        this.courseSection = "";
        this.departmentProps = [];
        this.campuses = [];
        this.sessions = CourseRequester.generateUpcomingSessions();
        this.requirementProps = [];
        this.instructor = "";
        this.courseLevels = [];
        this.deliveryModes = [];
        this.dayPreferences = [];
        this.timePreferences = [];
        this.divisions = [
            "APSC",
            "ARTSC",
            "ERIN",
            "SCAR"
        ];
        this.creditWeights = [];
        this.availableSpace = false;
        this.page = 1;
        this.pageSize = 20;
        this.direction = "asc";

        if (c) {
            this.courseCodeAndTitleProps = c.courseCodeAndTitleProps;
            this.courseSection = c.courseSection;
            this.departmentProps = c.departmentProps;
            this.campuses = c.campuses;
            this.sessions = c.sessions;
            this.requirementProps = c.requirementProps;
            this.instructor = c.instructor;
            this.courseLevels = c.courseLevels;
            this.deliveryModes = c.deliveryModes;
            this.dayPreferences = c.dayPreferences;
            this.timePreferences = c.timePreferences;
            this.divisions = c.divisions;
            this.creditWeights = c.creditWeights;
            this.availableSpace = c.availableSpace;
            this.page = c.page;
            this.pageSize = c.pageSize;
            this.direction = c.direction;
        }
    }
}

export class CourseMap extends Collection<string, TimestampedCourse> {
    /**
     * Fuzzy find a course from a single search parameter. Examples of valid queries include:
     * - CSC108H1
     * - csc108
     * - csc108 winter
     * - csc108h1 s
     * @param param The search string.
     * @returns A list of courses that match the query, or null if the query is malformed.
     */
    public fuzzyFind(param: string): TimestampedCourse[] | null {
        if (this.has(param)) return [this.get(param)!];

        let codeMatches = param.match(REGEX_CODE);
        let sessionMatches = param.match(REGEX_SESSION);

        // Well-formed queries must have 1 course code and no more than 1 session
        if (codeMatches === null) return null;
        if (codeMatches.length !== 1) return null;
        if (sessionMatches !== null && sessionMatches.length > 1) return null;

        let code = codeMatches[0].toUpperCase();
        let session = sessionMatches !== null ? `${sessionMatches[0].charAt(0).toUpperCase()}${sessionMatches[0].slice(1)}` : '';
        let foundCourses: TimestampedCourse[] = [];

        // Match any session
        if (session === '') {
            this.each(v => {
                if (v.code.includes(code, 0)) foundCourses.push(v);
            });
        // Match by section code (F, S, Y)
        } else if (['F', 'S', 'Y'].includes(session)) {
            this.each(v => {
                if (v.code.includes(code) && v.sectionCode === session) foundCourses.push(v);
            });
        // Alias for matching Y courses
        } else if (session === 'Year') {
            this.each(v => {
                if (v.code.includes(code) && v.sectionCode === 'Y') foundCourses.push(v);
            });
        // Everything else should match to a keyword
        } else {
            this.each(v => {
                if (v.code.includes(code) && v.session.includes(session)) foundCourses.push(v);
            });
        }
        return foundCourses;
    }
}

/**
 * Represents a course requester.
 * This class is responsible for making requests to the course API and retrieving course data.
 */
export class CourseRequester {

    /** A cache of courses. */
    private cache: CourseMap;

    /** The compare function used when updating the cache. */
    private static cacheComparator(a: TimestampedCourse, b: TimestampedCourse): number {
        // Sort by increasing timestamp, then by lexicographical course code.
        return a.timestamp - b.timestamp || a.code.localeCompare(b.code);
    }

    constructor() {
        this.cache = new CourseMap();

        // process.on('SIGINT', () => {
        //     this.db.close((err) => {
        //         if (err) console.error(err);
        //         else console.log('Database closed due to receiving SIGINT (^C).');
        //     });
        // });
    }

    public getCache(): CourseMap {
        return this.cache;
    }

    /**
     * Get the necessary sessions for the current time, only used for POST requests, since GET requests
     * require a slightly different format.
     * @returns An array of session codes.
     */
    public static generateCurrentSessions(): Array<string> {
        let sessions = [];
        let now = new Date();
        let mo: number = now.getMonth();
        let yr: number = now.getFullYear();
        let year: string = yr.toString();
        let nextYear: string = (yr+1).toString();
        let lastYear: string = (yr-1).toString();
        if (mo >= 9) {
            sessions.push(`${year}9`);
            sessions.push(`${nextYear}1`);
            sessions.push(`${year}9-${nextYear}1`);
        } else if (mo <= 4) {
            sessions.push(`${lastYear}9`);
            sessions.push(`${year}1`);
            sessions.push(`${lastYear}9-${year}1`);
        } else {
            sessions.push(`${year}5`);
            sessions.push(`${year}5F`);
            sessions.push(`${year}5S`);
        }
        return sessions;
    }

    public static generateUpcomingSessions(): Array<string> {
        let sessions = [];
        let now = new Date();
        let mo: number = now.getMonth();
        let yr: number = now.getFullYear();
        let year: string = yr.toString();
        let nextYear: string = (yr+1).toString();
        if (mo <= 4) {
            sessions.push(`${year}5`);
            sessions.push(`${year}5F`);
            sessions.push(`${year}5S`);
        } else if (mo >= 9) {
            sessions.push(`${nextYear}5`);
            sessions.push(`${nextYear}5F`);
            sessions.push(`${nextYear}5S`);
        } else {
            sessions.push(`${year}9`);
            sessions.push(`${nextYear}1`);
            sessions.push(`${year}9-${nextYear}1`);
        }
        return sessions;
    }

    /**
     * @param sessions The "sessions" field from an API response.
     * @returns A human-readable session name.
     */
    private static sessionsToString(sessions: Array<string>): string {
        // Year-long fall-winter courses
        if (sessions.length === 2 || sessions.length === 3) {
            let first = sessions.find(v => v.endsWith('9'));
            let second = sessions.find(v => v.endsWith('1'));
            let year = first?.slice(0, 4);
            let nextYear = second?.slice(0, 4);
            return `Fall-Winter ${year}-${nextYear}`;
        } else if (sessions.length === 1 && sessions[0].endsWith('5')) {
            return `Summer ${sessions[0].slice(0, 4)}`;
        } else if (sessions.length === 1 && sessions[0].endsWith('5F')) {
            return `Summer First Half ${sessions[0].slice(0, 4)}`;
        } else if (sessions.length === 1 && sessions[0].endsWith('5S')) {
            return `Summer Second Half ${sessions[0].slice(0, 4)}`;
        } else if (sessions.length === 1 && sessions[0].endsWith('9')) {
            return `Fall ${sessions[0].slice(0, 4)}`;
        } else if (sessions.length === 1 && sessions[0].endsWith('1')) {
            return `Winter ${sessions[0].slice(0, 4)}`;
        } else {
            return `Unknown Session`;
        }
    }

    /**
     * Fetch courses from UofT TTB API. Also updates the internal cache.
     * @param params A custom request body. If not provided, the default request body will be used.
     * @param page The page number to fetch. Setting this overrides the page field of "params".
     * @returns A CourseMap object containing the fetched courses on the current page, or null if the request failed. Note that only 20 courses can be fetched at a time.
     */
    public async fetchCourses(params?: CourseRequestBody, page?: number): Promise<CourseMap | null> {
        try {
            let requestBody: CourseRequestBody;
            if (params === undefined) {
                requestBody = new CourseRequestBody();
                requestBody.sessions = CourseRequester.generateUpcomingSessions();
            } else {
                requestBody = params;
            }
            requestBody.page = page ?? requestBody.page;
            let response = await axios.post(BASE_URL, requestBody, {headers: HEADER});
            let courses = new CourseMap();
            let courseSessionCode: string;
            let newCourse: TimestampedCourse;
            let now: number = Date.now();
            
            // No intellisense here, check the API response for the structure.
            for (let course of response.data.payload.pageableCourse.courses) {
                courseSessionCode = CourseRequester.sessionsToString(course.sessions);
                newCourse = {
                    id: course.id,
                    code: course.code,
                    session: courseSessionCode,
                    sectionCode: course.sectionCode,
                    title: course.name,
                    sections: new Collection<string, CourseSection>(),
                    timestamp: now
                }
                if (courseSessionCode === 'Unknown Session') continue;

                courses.set(`${newCourse.code} ${newCourse.session}`, newCourse);
                this.cache.set(`${newCourse.code} ${newCourse.session}`, newCourse);
                this.cache.sort(CourseRequester.cacheComparator);

                for (let section of course.sections) {
                    let instructor = section.instructors[0]? `${section.instructors[0].firstName} ${section.instructors[0].lastName}` : 'TBA';
                    let newSection: CourseSection = {
                        instructor: instructor,
                        max: section.maxEnrolment,
                        curr: section.currentEnrolment,
                        waitlist: section.currentWaitlist
                    }
                    newCourse.sections!.set(section.name, newSection);
                }
            }

            return courses;
        } catch (err) {
            console.error(err);
            return null;
        }
    }

    /**
     * Repeatedly fetches each page of all courses matching "params", and adds them to "collector".
     * @param params The request body to use.
     * @param collector Mutable collection to store courses.
     * @param ms The delay between each request in milliseconds.
     * 
     */
    public async fetchLoop(ms: number, params?: CourseRequestBody): Promise<NodeJS.Timeout> {
        if (!params) params = new CourseRequestBody();
        let page = params.page;
        console.log(`API request loop started, fetching courses every ${ms}ms.`);
        
        return setInterval(async () => { 
            let courses = await this.fetchCourses(params, page);
            if (courses && courses.size === 0) page = 1;
            else if (courses) page++;
        }, ms);
    }
}