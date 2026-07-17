export function getStudentProgressDockLabel(
  showProgress: boolean,
  showHelp: boolean,
): "Din fremdrift" | "Din fremdrift og hjelp" | "Hjelp" {
  if (showProgress && showHelp) return "Din fremdrift og hjelp";
  if (showProgress) return "Din fremdrift";
  return "Hjelp";
}
