// Surface coordinates are measured inside the visible (CSS-trimmed) source box.
// They describe the usable top, excluding the front fascia/drawers and legs.
export const OFFICE_ASPECT = 1619 / 971;
export const FURNITURE_SURFACES = {
 'WORK-01-desk-oak': {back:0.055,front:0.29,left:0.08,right:0.92},
 'WORK-08-desk-cream': {back:0.055,front:0.27,left:0.08,right:0.92},
 'WORK-10-meeting-table': {back:0.055,front:0.38,left:0.08,right:0.92},
 'DECOR-11-storage-cabinet': {back:0.055,front:0.18,left:0.08,right:0.92},
 'DECOR-01-storage-planter-base': {back:0.055,front:0.23,left:0.08,right:0.92},
};

export const DESKTOP_ITEMS = [
 {suffix:'laptop',asset:'WORK-03-laptop-open',u:0.43,v:0.235,ratio:0.225},
 {suffix:'lamp',asset:'WORK-12-task-lamp',u:0.82,v:0.16,ratio:0.105},
 {suffix:'notebook',asset:'DECOR-15-notebook',u:0.68,v:0.245,ratio:0.125},
 {suffix:'mug',asset:'DECOR-13-mug',u:0.18,v:0.235,ratio:0.05},
];

export const SURFACE_ITEMS = [
 {id:'coffee-machine',parent:'coffee-cabinet',asset:'DECOR-14-coffee-machine',u:0.35,v:0.145,ratio:0.20},
 {id:'coffee-mug',parent:'coffee-cabinet',asset:'DECOR-13-mug',u:0.72,v:0.14,ratio:0.05},
 {id:'rear-plant-1',parent:'rear-storage-1',asset:'DECOR-09-shelf-plant',u:0.23,v:0.18,ratio:0.16},
 {id:'rear-plant-2',parent:'rear-storage-1',asset:'DECOR-20-snake-plant',u:0.77,v:0.18,ratio:0.13},
 {id:'rear-plant-3',parent:'rear-storage-2',asset:'DECOR-09-shelf-plant',u:0.23,v:0.18,ratio:0.16},
 {id:'rear-plant-4',parent:'rear-storage-2',asset:'DECOR-19-prickly-pear',u:0.77,v:0.18,ratio:0.13},
 {id:'review-monitor-1',parent:'review-desk-1',asset:'WORK-04-monitor',u:0.43,v:0.16,ratio:0.27},
 {id:'review-monitor-2',parent:'review-desk-2',asset:'WORK-04-monitor',u:0.43,v:0.16,ratio:0.27},
 {id:'review-keyboard-1',parent:'review-desk-1',asset:'WORK-05-keyboard',u:0.43,v:0.245,ratio:0.24},
 {id:'review-keyboard-2',parent:'review-desk-2',asset:'WORK-05-keyboard',u:0.43,v:0.245,ratio:0.24},
 {id:'presentation-laptop',parent:'presentation-table',asset:'WORK-03-laptop-open',u:0.50,v:0.28,ratio:0.19},
];

export function surfaceAttachment(parent,item,assets) {
 const source=assets[parent.asset];
 const [l,t,r,b]=source.bounds;
 const height=parent.width*(b-t)/(r-l)*OFFICE_ASPECT;
 return {
  id:item.id||`${parent.id}-${item.suffix}`,asset:item.asset,
  x:parent.x+parent.width*(item.u-0.5),
  y:parent.y-height*(1-item.v),
  width:parent.width*item.ratio,
  depth:Math.round(parent.y)+1,
  parent:parent.id,
 };
}
