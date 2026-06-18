import { Component } from "react";
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from "react-native";

export default class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <View style={styles.wrap}>
          <Text style={styles.title}>앱 오류</Text>
          <ScrollView style={styles.box}>
            <Text style={styles.msg}>{String(this.state.error?.message ?? this.state.error)}</Text>
          </ScrollView>
          <TouchableOpacity style={styles.btn} onPress={() => this.setState({ error: null })}>
            <Text style={styles.btnText}>다시 시도</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: "#FAF7F2", padding: 24, paddingTop: 60 },
  title: { fontSize: 18, fontWeight: "700", color: "#3D3530", marginBottom: 12 },
  box: { flex: 1, backgroundColor: "#fff", borderRadius: 12, padding: 16, marginBottom: 16 },
  msg: { fontSize: 13, color: "#8C7B72", lineHeight: 20 },
  btn: { backgroundColor: "#C17F5B", padding: 14, borderRadius: 12, alignItems: "center" },
  btnText: { color: "#fff", fontWeight: "700" },
});
