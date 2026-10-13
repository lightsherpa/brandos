// Fail closed before performing any queue insert or assignment.
export async function queueDiscoveryReview(report, enqueue) {
 if(report?.meetsFloor!==true)return null;
 return enqueue();
}
