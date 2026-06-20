import React, { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { ALL_COURSES } from "../../data/courses";
import { PrimaryButton } from "../../components/PrimaryButton";
import {
  formatVirtualCourseProgress,
  loadVirtualCourseProgress,
} from "../../storage/virtual-run-history";
import type { VirtualCourseProgress } from "../../types/virtualCourse";

interface CourseSelectScreenProps {
  onBack: () => void;
  onSelectCourse: (courseId: string) => void;
  userId: string;
}

export function CourseSelectScreen({ onBack, onSelectCourse, userId }: CourseSelectScreenProps) {
  const [progressByCourse, setProgressByCourse] = useState<Record<string, VirtualCourseProgress>>({});

  useEffect(() => {
    let isMounted = true;
    loadVirtualCourseProgress(userId).then((progress) => {
      if (isMounted) {
        setProgressByCourse(progress);
      }
    });
    return () => {
      isMounted = false;
    };
  }, [userId]);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View>
        <Text style={styles.kicker}>Virtual Global Course</Text>
        <Text style={styles.title}>Pick a route to run from home.</Text>
      </View>

      {ALL_COURSES.map((course) => (
        <View key={course.id} style={[styles.card, { borderColor: course.accentColor }]}>
          <View style={styles.cardHeader}>
            <View style={[styles.swatch, { backgroundColor: course.accentColor }]} />
            <View style={styles.cardCopy}>
              <Text style={styles.cardTitle}>{course.name}</Text>
              <Text style={styles.meta}>
                {course.city}, {course.country} - {(course.totalDistanceMeters / 1000).toFixed(1)} km
              </Text>
            </View>
            {progressByCourse[course.id]?.isCompleted ? <Text style={styles.completedBadge}>Completed</Text> : null}
          </View>
          <Text style={styles.body}>{course.description}</Text>
          <Text style={styles.meta}>
            {course.checkpoints.length} checkpoints - {course.ghosts.length} ghost runner
            {course.ghosts.length === 1 ? "" : "s"}
          </Text>
          <View style={styles.detailRow}>
            <Text style={styles.detailPill}>{getDifficultyLabel(course.totalDistanceMeters)}</Text>
            <Text style={styles.detailPill}>{getEstimatedDuration(course.totalDistanceMeters)}</Text>
            <Text style={styles.detailPill}>{formatVirtualCourseProgress(progressByCourse[course.id])}</Text>
          </View>
          <PrimaryButton label="Run This Course" onPress={() => onSelectCourse(course.id)} />
        </View>
      ))}

      <PrimaryButton label="Back" variant="secondary" onPress={onBack} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 16,
    padding: 20,
  },
  kicker: {
    color: "#0f766e",
    fontSize: 13,
    fontWeight: "800",
  },
  title: {
    marginTop: 8,
    color: "#0f172a",
    fontSize: 30,
    fontWeight: "900",
    lineHeight: 36,
  },
  card: {
    gap: 12,
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: "#ffffff",
    padding: 16,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  swatch: {
    width: 12,
    height: 52,
    borderRadius: 999,
  },
  cardCopy: {
    flex: 1,
  },
  cardTitle: {
    color: "#0f172a",
    fontSize: 18,
    fontWeight: "900",
  },
  body: {
    color: "#475569",
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 20,
  },
  meta: {
    color: "#64748b",
    fontSize: 13,
    fontWeight: "800",
  },
  completedBadge: {
    borderRadius: 999,
    backgroundColor: "#dcfce7",
    color: "#166534",
    fontSize: 11,
    fontWeight: "900",
    overflow: "hidden",
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  detailRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  detailPill: {
    borderRadius: 999,
    backgroundColor: "#f1f5f9",
    color: "#334155",
    fontSize: 12,
    fontWeight: "800",
    overflow: "hidden",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
});

function getDifficultyLabel(distanceMeters: number): string {
  if (distanceMeters <= 7000) {
    return "Easy";
  }
  if (distanceMeters <= 9000) {
    return "Moderate";
  }
  return "Long";
}

function getEstimatedDuration(distanceMeters: number): string {
  const estimatedSeconds = Math.round((distanceMeters / 1000) * 390);
  const minutes = Math.round(estimatedSeconds / 60);
  return `About ${minutes} min`;
}
