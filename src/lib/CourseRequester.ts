import axios, { AxiosRequestHeaders, get } from 'axios';
import { AxiosHeaders } from 'axios';
import assert from 'assert';
import { Collection } from 'discord.js';
import { URLSearchParams } from 'url';
import { Course, CourseSection, CachedCourse } from './Course';

const INFO_URL: string = 'https://api.easi.utoronto.ca/ttb/getPageableCourses';
const SEARCH_URL: string = 'https://api.easi.utoronto.ca/ttb/getOptimizedMatchingCourseTitles';
const HEADER: AxiosRequestHeaders = new AxiosHeaders({
    'Content-Type': 'application/json',
    'Accept': 'application/json',
});

export type CourseRequestBody = {
    courseCodeAndTitleProps: {
        courseCode: string,
        courseTitle: string,
        courseSectionCode: string,
        searchCourseDescription: boolean,
    },
    courseSection: string,
    departmentProps: Array<any>,
    campuses: Array<string>,
    sessions: Array<string>,
    requirementProps: Array<any>,
    instructor: string,
    courseLevels: Array<string>,
    deliveryModes: Array<string>,
    dayPreferences: Array<string>,
    timePreferences: Array<string>,
    divisions: Array<string>,
    creditWeights: Array<string>,
    page: number,
    pageSize: number,
    direction: string
};

/**
 * Represents a course requester.
 * This class is responsible for making requests to the course API and retrieving course data.
 */
export class CourseRequester {
    /**
     * The rate limit for making requests to the course API.
     */
    private rateLimit: number;

    /**
     * The timestamp of the last request made to the course API.
     */
    private lastRequest: number;

    /**
     * A cache of known course titles.
     */
    private cache: Collection<string, CachedCourse> = new Collection();

    /**
     * Get the necessary sessions for the current time, only used for POST requests, since GET requests
     * require a slightly different format.
     * @returns An array of session codes.
     */
    private static generateCurrentSessions(): Array<string> {
        let sessions = [];
        let now = new Date();
        let mo: number = now.getMonth();
        let yr: number = now.getFullYear();
        let year: string = yr.toString();
        let nextYear: string = (yr+1).toString();
        let lastYear: string = (yr-1).toString();
        // If currently winter semester, add S, Y, and next summer
        if (1 <= mo && mo <= 4) {
            sessions.push(`${year}1`);
            sessions.push(`${lastYear}9-${year}1`);
            sessions.push(`${year}5`);
            sessions.push(`${year}5F`);
            sessions.push(`${year}5S`);
        // If early summer, add only summer courses
        } else if (mo == 5) {
            sessions.push(`${year}5`);
            sessions.push(`${year}5F`);
            sessions.push(`${year}5S`);
        // If mid/late summer, add summer courses and upcoming F, S, Y
        } else if (6 <= mo && mo <= 8) {
            sessions.push(`${year}9`);
            sessions.push(`${nextYear}1`);
            sessions.push(`${year}9-${nextYear}1`);
            sessions.push(`${year}5`);
            sessions.push(`${year}5F`);
            sessions.push(`${year}5S`);
        // If early fall, add F, S, Y
        } else {
            sessions.push(`${year}9`);
            sessions.push(`${nextYear}1`);
            sessions.push(`${year}9-${nextYear}1`);
        }
        return sessions;
    }

    /**
     * Get the necessary sessions for the current time, only used for GET requests.
     * @returns An array of session codes.
     */
    private static generateUpcomingSessions(): Array<string> {
        let sessions = [];
        let now = new Date();
        let mo: number = now.getMonth();
        let yr: number = now.getFullYear();
        let year: string = yr.toString();
        let nextYear: string = (yr+1).toString();
        // If in Summer, add Fall-Winter
        if (mo >= 9 || mo <= 4) {
            sessions.push(`${year}5`);
            sessions.push(`${year}5F`);
            sessions.push(`${year}5S`);
        // If in Fall-Winter, add Summer
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
    private static parseSessions(sessions: Array<string>): string {
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


    private static defaultBody: CourseRequestBody = {
        courseCodeAndTitleProps: {
            courseCode: "",
            courseTitle: "",
            courseSectionCode: "",
            searchCourseDescription: false
        },
        courseSection: "",
        departmentProps: [],
        campuses: [],
        sessions: [],
        requirementProps: [],
        instructor: "",
        courseLevels: [],
        deliveryModes: [],
        dayPreferences: [],
        timePreferences: [],
        divisions: [
            "ARTSC"
        ],
        creditWeights: [],
        page: 1,
        pageSize: 5,
        direction: "ASC"
    };
    

    constructor(rateLimit: number = 100) {
        this.rateLimit = 100;
        this.lastRequest = 0;
    }

    /**
     * Search for courses based on a search term.
     * @param searchTerm The search term.
     * @returns A list of courses whose code or title includes the search term.
     */
    public async searchCourses(searchTerm: string): Promise<Course[] | null> {
        try {
            let params = new URLSearchParams();
            let sessions: string[] = CourseRequester.generateUpcomingSessions();
            let courses: Course[] = [];
            params.append('term', searchTerm);
            params.append('divisions', 'ARTSC');
            sessions.forEach(v => params.append('sessions', v));
            params.append('lowerThreshold', '50');
            params.append('upperThreshold', '200');

            let {data} = await axios.get(`${SEARCH_URL}?${params.toString()}`, {headers: HEADER});
            for (let result of data.payload.codesAndTitles) {
                let newCourse: Course = {
                    id: null,
                    code: result.code,
                    session: CourseRequester.parseSessions(result.sessions),
                    sectionCode: result.sectionCode,
                    title: result.name,
                    sections: null
                }
                courses.push(newCourse);
                this.cache.set(`${newCourse.code},${newCourse.session}`, {course: newCourse, lastUpdated: Date.now()});
            }

            return courses;
        } catch(error) {
            console.error(error);
            return null;
        } 
    }

    /**
     * 
     * @param courseCode Exact course code (e.g. CSC108H1).
     * @returns Section information of every course whose code matches `courseCode`, or null if the course is not found.
     */
    public async getCourseInfo(courseCode: string): Promise<Course[] | null> {
        try {
            let currentSessionCodes = CourseRequester.generateUpcomingSessions();
            let relevantSessionNames: string[] = [];
            currentSessionCodes.forEach(v => relevantSessionNames.push(`${CourseRequester.parseSessions([v])}`));
            let courses: Course[] = []; // Should only have same course in different sessions
            let requestedCourse: Course;
            let body: CourseRequestBody = CourseRequester.defaultBody;
            let foundCoursesRaw: any;

            // Try filling courses array
            for (const session of relevantSessionNames) {
                let cacheCheck = this.cache.get(`${courseCode},${session}`);
                if (cacheCheck) courses.push(cacheCheck.course);
            }
            if (courses.length === 0) await this.searchCourses(courseCode);
            for (const session of relevantSessionNames) {
                let cacheCheck = this.cache.get(`${courseCode},${session}`);
                if (cacheCheck) courses.push(cacheCheck.course);
            }
            if (courses.length === 0) return null;

            // Prepare and send POST request
            requestedCourse = courses[0];
            body.courseCodeAndTitleProps = {
                courseCode: requestedCourse.code,
                courseTitle: requestedCourse.title,
                courseSectionCode: "",
                searchCourseDescription: false
            };
            //NOTE: Replace with getSessions() if needed
            body.sessions = currentSessionCodes;
            let {data} = await axios.post(INFO_URL, body, {headers: HEADER});
            if (data.payload.pageableCourse.courses.length === 0) return null;
            foundCoursesRaw = data.payload.pageableCourse.courses;
            courses.forEach(c => c.sections = new Collection<string, CourseSection>());
            
            // Parse the course sections
            for (let courseRaw of foundCoursesRaw) {
                let foundCode = `${courseRaw.code}`;
                let foundSession = `${CourseRequester.parseSessions(courseRaw.sessions)}`;
                
                let matchingCachedCourse = courses.find(c => c.code === foundCode && c.session === foundSession);
                if (!matchingCachedCourse) continue;

                for (let sectionRaw of courseRaw.sections) {
                    let instructor = sectionRaw.instructors[0]? `${sectionRaw.instructors[0].firstName} ${sectionRaw.instructors[0].lastName}` : 'TBA';
                    let section: CourseSection = {
                        instructor: instructor,
                        max: sectionRaw.maxEnrolment,
                        curr: sectionRaw.currentEnrolment,
                        waitlist: sectionRaw.currentWaitlist
                    };
                    matchingCachedCourse.sections!.set(sectionRaw.name, section);
                }
                this.cache.set(`${matchingCachedCourse.code},${matchingCachedCourse.session}`, {course: requestedCourse, lastUpdated: Date.now()});
            }
            return courses;
            
        } catch(error) {
            console.error(error);
            return null;
        }
    }
    
}