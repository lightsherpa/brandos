export const crewCanvasEnabled = ['1', 'true'].includes(String(import.meta.env?.VITE_CREW_CANVAS || '').toLowerCase());
export function requestedCrew(context = {}) {
  const normalize = type => type === 'email' ? 'email_sequence' : type;
  const explicit = normalize(context.requestedTaskType || context.taskType);
  if (['social_post', 'email_sequence'].includes(explicit)) return explicit;
  const types = [...new Set((context.deliveryPlan?.deliverableGroups || []).map(group => normalize(group.type)))];
  return types.length === 1 && ['social_post', 'email_sequence'].includes(types[0]) ? types[0] : null;
}
export function crewRoles(type, heroes) {
  return type === 'social_post' ? ['copy', 'image', 'compositor', 'qa'] : ['copy', 'html', ...(heroes ? ['hero'] : []), 'qa'];
}
export function crewDeliverables(task) {
  return (task?.items || []).filter(item => ['ready','approved'].includes(item?.status) && item.html);
}
const en = {
  renderRetry:'Retry rendering', canvas:'Canvas', intro:'One focused crew. Finished work, grounded in Brand Core.', social_post:'Social post', email_sequence:'Email sequence',
  copy:'Copy',image:'Image',compositor:'Brand composition',qa:'Quality review',html:'HTML rendering',hero:'Hero image',
  choose:'Choose the task to produce',run:'Produce this task',running:'The crew is working',ready:'Ready for your review',failed:'We could not finish this piece. Try again.',redo:"We’re redoing this",waiting:'Your finished work will appear here after quality review.',
  brief:'Approved brief',crew:'Active crew',project:'On this project',none:'Finished deliverables appear here.',heroes:'Include a hero image in every email',back:'Back to brief',
  artifact:'Deliverable',edit:'Edit a component',replace:'Replace',regenerate:'Regenerate this piece',save:'Save replacement',cancel:'Cancel',feedback:'Revise with feedback',feedbackHint:'What should change in this component?',value:'Replacement',
  caption:'Caption',overlay_line:'Headline overlay',cta:'Call to action',subject:'Subject',preheader:'Preheader',headline:'Headline',body_blocks:'Body', 'cta.label':'Button label','cta.url':'Button destination',
  safe:'Only quality-checked work is shown.',retry:'Retry',saved:'This component was updated.',error:'The change could not be completed. Your previous work is safe.',download:'Download HTML',progress:'Production progress',checking:'Checking brand, typography and image quality',count:'Deliverables',select:'Select a deliverable to inspect its components',unavailable:'Enable Crew Canvas on the API to produce this task.',
};
const es = {
  renderRetry:'Reintentar la composición', canvas:'Canvas',intro:'Un equipo centrado en tu tarea. Trabajo terminado, basado en Brand Core.',social_post:'Publicación social',email_sequence:'Secuencia de emails',copy:'Texto',image:'Imagen',compositor:'Composición de marca',qa:'Revisión de calidad',html:'Diseño HTML',hero:'Imagen de cabecera',choose:'Elige la tarea que quieres producir',run:'Producir esta tarea',running:'El equipo está trabajando',ready:'Listo para tu revisión',failed:'No pudimos terminar esta pieza. Inténtalo de nuevo.',redo:'Estamos rehaciendo esta pieza',waiting:'El trabajo terminado aparecerá aquí después de la revisión de calidad.',brief:'Brief aprobado',crew:'Equipo activo',project:'En este proyecto',none:'Aquí aparecerán las entregas terminadas.',heroes:'Incluir una imagen de cabecera en cada email',back:'Volver al brief',artifact:'Entrega',edit:'Editar un componente',replace:'Reemplazar',regenerate:'Regenerar esta pieza',save:'Guardar reemplazo',cancel:'Cancelar',feedback:'Revisar con comentarios',feedbackHint:'¿Qué debe cambiar en este componente?',value:'Reemplazo',caption:'Texto de publicación',overlay_line:'Titular sobre la imagen',cta:'Llamada a la acción',subject:'Asunto',preheader:'Preencabezado',headline:'Titular',body_blocks:'Cuerpo','cta.label':'Texto del botón','cta.url':'Destino del botón',safe:'Solo se muestra trabajo que ha superado la revisión de calidad.',retry:'Reintentar',saved:'Este componente se ha actualizado.',error:'No se pudo completar el cambio. Tu trabajo anterior está guardado.',download:'Descargar HTML',progress:'Progreso de producción',checking:'Revisando marca, tipografía y calidad de imagen',count:'Entregas',select:'Selecciona una entrega para revisar sus componentes',unavailable:'Activa Crew Canvas en la API para producir esta tarea.',
};
const ar = {
  renderRetry:'إعادة عرض التصميم', canvas:'Canvas',intro:'فريق مخصص لمهمتك. عمل مكتمل يستند إلى Brand Core.',social_post:'منشور اجتماعي',email_sequence:'سلسلة رسائل بريد',copy:'النص',image:'الصورة',compositor:'تكوين الهوية',qa:'مراجعة الجودة',html:'تصميم HTML',hero:'الصورة الرئيسية',choose:'اختر المهمة التي تريد إنتاجها',run:'إنتاج هذه المهمة',running:'الفريق يعمل الآن',ready:'جاهز لمراجعتك',failed:'تعذر إكمال هذه القطعة. حاول مرة أخرى.',redo:'نعيد إنتاج هذه القطعة',waiting:'سيظهر العمل المكتمل هنا بعد مراجعة الجودة.',brief:'الموجز المعتمد',crew:'الفريق الحالي',project:'في هذا المشروع',none:'ستظهر التسليمات المكتملة هنا.',heroes:'إضافة صورة رئيسية لكل رسالة',back:'العودة إلى الموجز',artifact:'تسليم',edit:'تعديل مكوّن',replace:'استبدال',regenerate:'إعادة إنتاج هذه القطعة',save:'حفظ الاستبدال',cancel:'إلغاء',feedback:'مراجعة مع ملاحظات',feedbackHint:'ما الذي يجب تغييره في هذا المكوّن؟',value:'البديل',caption:'نص المنشور',overlay_line:'العنوان فوق الصورة',cta:'دعوة لاتخاذ إجراء',subject:'الموضوع',preheader:'النص التمهيدي',headline:'العنوان',body_blocks:'المحتوى','cta.label':'نص الزر','cta.url':'رابط الزر',safe:'نعرض فقط العمل الذي اجتاز مراجعة الجودة.',retry:'إعادة المحاولة',saved:'تم تحديث هذا المكوّن.',error:'تعذر إكمال التغيير. عملك السابق محفوظ.',download:'تنزيل HTML',progress:'تقدم الإنتاج',checking:'مراجعة الهوية والخطوط وجودة الصورة',count:'التسليمات',select:'اختر تسليمًا لفحص مكوناته',unavailable:'فعّل Crew Canvas في واجهة API لإنتاج هذه المهمة.',
};
export const crewCopy = locale => ({en,es,ar}[locale] || en);
