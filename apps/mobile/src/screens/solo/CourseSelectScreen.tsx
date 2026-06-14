import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { ALL_COURSES } from "../../data/courses";
import { PrimaryButton } from "../../components/PrimaryButton";

interface CourseSelectScreenProps {
  onBack: () => void;
  onSelectCourse: (courseId: string) => void;
}

export function CourseSelectScreen({ onBack, onSelectCourse }: CourseSelectScreenProps) {
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
          </View>
          <Text style={styles.body}>{course.description}</Text>
          <Text style={styles.meta}>
            {course.checkpoints.length} checkpoints - {course.ghosts.length} ghost runner
            {course.ghosts.length === 1 ? "" : "s"}
          </Text>
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
});
