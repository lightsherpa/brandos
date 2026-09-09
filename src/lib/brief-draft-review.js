export function editBriefInput(payload, input) {
  // Editing the brief invalidates runtime approval, not the user's answers.
  return { ...payload, input };
}

export function replaceDraftAnalysis(payload, sharpData) {
  const previous = payload.sharpData?.questions || [];
  const questions = sharpData.questions || [];
  const answers = Object.fromEntries(questions.map((q, index) => {
    const oldIndex = previous.findIndex((old) => old.q === q.q);
    return [index, payload.answers[oldIndex] || ""];
  }));
  const history = [...(payload.answerHistory || [])];
  previous.forEach((q, index) => {
    const answer = payload.answers[index];
    if (answer?.trim() && !questions.some((next) => next.q === q.q)
      && !history.some((entry) => entry.question === q.q && entry.answer === answer)) {
      history.push({ question: q.q, answer });
    }
  });
  return { ...payload, sharpData, answers, answerHistory: history, qStep: 0 };
}
