// Positions refer to the supplied 1619 × 971 office shell; y is the ground anchor.
export const OFFICE_STATIONS = [
 {id:'strategy',x:42,y:37}, {id:'concept',x:61,y:37},
 {id:'copy',x:42,y:62}, {id:'visual',x:61,y:62},
];
export const OFFICE_DECOR = [
 ['brief-table','WORK-10-meeting-table',14,21,12],
 ['brief-chair','WORK-02-chair-orange-right',19,26,3],
 ['brief-plant','DECOR-06-floor-plant',6,25,3],
 ['lounge-rug','DECOR-12-rug',14,54,16,0],
 ['lounge-sofa','DECOR-04-sofa',12,44,12],
 ['lounge-table','DECOR-05-coffee-table',13,51,7],
 ['lounge-armchair','DECOR-21-lounge-armchair',20,52,4],
 ['lounge-plant','DECOR-06-floor-plant',6,54,3],
 ['library-shelf','DECOR-10-oak-bookshelf',8,78,4],
 ['library-cabinet','DECOR-11-storage-cabinet',17,77,9],
 ['library-plant','DECOR-20-snake-plant',21,79,2.5],
 ['review-desk-1','WORK-08-desk-cream',83,23,7],
 ['review-desk-2','WORK-08-desk-cream',92,23,7],
 ['review-chair-1','WORK-09-chair-charcoal-front',83,29,2.7],
 ['review-chair-2','WORK-09-chair-charcoal-front',92,29,2.7],
 ['review-plant','DECOR-19-prickly-pear',96,27,2.7],
 ['presentation-table','WORK-10-meeting-table',87,51,13],
 ['presentation-chair-1','WORK-02-chair-orange-front',84,55,2.8],
 ['presentation-chair-2','WORK-02-chair-orange-front',90,55,2.8],
 ['presentation-plant','DECOR-18-barrel-cactus',96,54,2.7],
 ['coffee-cabinet','DECOR-11-storage-cabinet',85,72,12],
 ['coffee-armchair','DECOR-21-lounge-armchair',93,77,4],
 ['coffee-plant','DECOR-17-column-cactus',78,78,2.7],
 ['rear-storage-1','DECOR-01-storage-planter-base',41,21,12],
 ['rear-storage-2','DECOR-01-storage-planter-base',62,21,12],
 ['studio-plant-left','DECOR-06-floor-plant',29,66,3.5],
 ['studio-plant-right','DECOR-06-floor-plant',72,66,3.5],
];
export const OFFICE_ART = [
 ['studio-art-1','DECOR-03-abstract-art',30,19,4.2,22],
 ['studio-art-2','DECOR-03-abstract-art',71,19,4.2,22],
 ['library-board','DECOR-16-concept-pinboard',16,67,7,20],
];

export function generatedOfficeRoute(origin, destination) {
 // Side rooms connect through their existing doorway, never through the shell walls.
 const portal = ([x,y]) => x<25 ? [[23,y<31?23:y<57?49:74],[28,y<31?23:y<57?49:74]] : x>75 ? [[77,y<31?23:y<57?49:74],[72,y<31?23:y<57?49:74]] : [];
 const from=portal(origin),to=portal(destination);
 const start=from.at(-1)||origin,end=to.at(-1)||destination;
 return [...from,[start[0],81],[end[0],81],...to.slice().reverse(),destination];
}
