import type { TeacherStudent } from "@/types/shared";

export type Student = TeacherStudent;

export type Class = {
  id: string;
  name: string;
  grade_id: string | null;
  students: Student[];
};

export type Trinn = {
  id: string;
  name: string;
  grade_id: string | null;
  classes: Class[];
};

export type ClassesAccordionProps = {
  onStudentClick?: (student: Student) => void;
  teacherId?: string;
  searchQuery?: string;
};

export type DropdownPosition = {
  x: number;
  y: number;
};

export type OpenMenu = {
  type: "trinn" | "class" | "student";
  id: string;
  student?: Student;
  position: DropdownPosition;
} | null;
