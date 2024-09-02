import {CourseMap} from '../lib/CourseRequester';
import {describe, expect, test} from '@jest/globals';

const positives = [
    'CSC108H1',
    'Csc108',
    '$12 x  csC108  ()',
    'csc108 winter ',
    'csc108h1  s',
    '       (winter) csc108',
];

const negatives = [
    'CSC108H5',
    'csc1080',
    'CSC108H1 F',
    'csc108H1  Y',
    'csc108h1 fall',
    'csc108y1',
    'csc108 summer',
    'csc108 first'
];

const badQueries = [
    '',
    '   ~ !!! ',
    'CSCS108H1',
    'asdfghjkl\n\r\t',
    'a'.repeat(100),
    'csc11111',
    'csc108 winter winter',
    'csc108 f s',
    'csc108h7',
];

const csc108 = {
    id: null,
    code: 'CSC108H1',
    session: 'Winter 2022',
    sectionCode: 'S',
    title: 'Introduction to Computer Programming',
    sections: null,
    timestamp: 0
};

const cm = new CourseMap();
cm.set(`${csc108.code} ${csc108.session}`, csc108);

describe('Course Fuzzy Search', () => {
    test.each(positives)('Query: %s', (course) => {
        expect(cm.fuzzyFind(course)![0].code).toStrictEqual(csc108.code);
    });
    test.each(negatives)('Negative query: %s', (course) => {
        expect(cm.fuzzyFind(course)).toStrictEqual([]);
    });
    test.each(badQueries)('Bad query: %s', (course) => {
        expect(cm.fuzzyFind(course)).toStrictEqual(null);
    });
});