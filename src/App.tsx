import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Layout from "@/components/Layout";
import Dashboard from "@/pages/Dashboard";
import Files from "@/pages/Files";
import Todos from "@/pages/Todos";
import Notes from "@/pages/Notes";
import Graph from "@/pages/Graph";
import Chat from "@/pages/Chat";
import Timeline from "@/pages/Timeline";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/files" element={<Files />} />
          <Route path="/todos" element={<Todos />} />
          <Route path="/notes" element={<Notes />} />
          <Route path="/graph" element={<Graph />} />
          <Route path="/chat" element={<Chat />} />
          <Route path="/timeline" element={<Timeline />} />
        </Route>
      </Routes>
    </Router>
  );
}
