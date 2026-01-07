import { useEffect, useState } from "react";
import axios from "axios";
import { io } from "socket.io-client";
import "./App.css";

/* ======================
   BACKEND BASE URL
====================== */
const BASE_URL = import.meta.env.VITE_API_BASE;
console.log("VITE_API_BASE =", import.meta.env.VITE_API_BASE);


/* ======================
   SOCKET.IO
====================== */
const socket = io(BASE_URL, {
  transports: ["websocket", "polling"]
});

function App() {
  const [parsed, setParsed] = useState(0);
  const [saved, setSaved] = useState(0);
  const [total, setTotal] = useState(0);

  const [cases, setCases] = useState([]);
  const [filteredCases, setFilteredCases] = useState([]);

  // filters
  const [searchText, setSearchText] = useState("");
  const [hospitalGroup, setHospitalGroup] = useState("");
  const [tpa, setTpa] = useState("");

  const [hospitalGroups, setHospitalGroups] = useState([]);
  const [tpas, setTpas] = useState([]);

  /* ======================
     LOAD DASHBOARD
  ====================== */
  const loadDashboard = async () => {
    try {
      const countRes = await axios.get(`${BASE_URL}/api/dashboard/counts`);
      const casesRes = await axios.get(`${BASE_URL}/api/dashboard/cases`);

      const parsedCount = countRes.data.parsed;
      const savedCount = countRes.data.saved;

      setParsed(parsedCount);
      setSaved(savedCount);
      setTotal(parsedCount + savedCount);

      setCases(casesRes.data);
      setFilteredCases(casesRes.data);

      setHospitalGroups([
        ...new Set(casesRes.data.map(c => c.hospital_group))
      ]);

      setTpas([
        ...new Set(casesRes.data.map(c => c.tpa_name))
      ]);

    } catch (err) {
      console.error("Failed to load dashboard", err);
    }
  };

  /* ======================
     APPLY FILTERS
  ====================== */
  const [showResultInfo, setShowResultInfo] = useState(false);
  const [resultSummary, setResultSummary] = useState("");

  const applyFilters = () => {
    let data = [...cases];
    let summaryParts = [];

    if (searchText.trim()) {
      const q = searchText.toLowerCase();
      data = data.filter(c =>
        (c.patient_name || "").toLowerCase().includes(q) ||
        (c.al_number || "").toLowerCase().includes(q) ||
        (c.policy_number || "").toLowerCase().includes(q)
      );
      summaryParts.push(`Keyword: "${searchText}"`);
    }

    if (hospitalGroup) {
      data = data.filter(c => c.hospital_group === hospitalGroup);
      summaryParts.push(`Hospital Group: ${hospitalGroup}`);
    }

    if (tpa) {
      data = data.filter(c => c.tpa_name === tpa);
      summaryParts.push(`TPA: ${tpa}`);
    }

    setFilteredCases(data);

    if (summaryParts.length > 0) {
      setShowResultInfo(true);
      setResultSummary(
        `Showing results for ${summaryParts.join(" • ")} — ${data.length} result(s) found`
      );
    } else {
      setShowResultInfo(false);
    }
  };

  const resetFilters = () => {
    setSearchText("");
    setHospitalGroup("");
    setTpa("");
    setFilteredCases(cases);
    setShowResultInfo(false);
  };

  /* ======================
     SOCKET LISTENER
  ====================== */
  useEffect(() => {
    loadDashboard();

    socket.on("bot_update", loadDashboard);

    return () => {
      socket.off("bot_update");
    };
  }, []);

  /* ======================
     TPA DEPENDENCY
  ====================== */
  useEffect(() => {
    if (!hospitalGroup) {
      setTpas([...new Set(cases.map(c => c.tpa_name))]);
      return;
    }

    setTpas([
      ...new Set(
        cases
          .filter(c => c.hospital_group === hospitalGroup)
          .map(c => c.tpa_name)
      )
    ]);
    setTpa("");
  }, [hospitalGroup, cases]);

  /* ======================
     TAT CALCULATION
  ====================== */
  const calculateTAT = (parsedTime, savedTime) => {
    if (!parsedTime || !savedTime) return "-";

    const parsedMs = new Date(parsedTime).getTime();
    const savedMs = new Date(savedTime).getTime();

    if (isNaN(parsedMs) || isNaN(savedMs)) return "-";

    const diffSeconds = Math.floor((savedMs - parsedMs) / 1000);
    return diffSeconds >= 0 ? `${diffSeconds}s` : "-";
  };

  return (
    <>
      {/* HEADER */}
      <div className="header">
        <div className="header-content header-flex">
          <div className="header-left">
            <img
              src="/abi-logo.png"
              alt="ABI Health"
              className="header-logo"
            />
            <div>
              <h1>IBM Bot Dashboard</h1>
              <p>Realtime monitoring of bot-processed IBM cases</p>
            </div>
          </div>
        </div>
      </div>

      <div className="app">

        {/* CARDS */}
        <div className="cards">
          <div className="card parsed">
            <h3>Parsed Cases</h3>
            <span>{parsed}</span>
          </div>

          <div className="card saved">
            <h3>Saved Cases</h3>
            <span>{saved}</span>
          </div>

          <div className="card total">
            <h3>Total Cases</h3>
            <span>{total}</span>
          </div>
        </div>

        {/* FILTERS */}
        <div className="filters">
          <input
            type="text"
            placeholder="Search Patient / AL / Policy"
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
          />

          <select value={hospitalGroup} onChange={e => setHospitalGroup(e.target.value)}>
            <option value="">All Hospital Groups</option>
            {hospitalGroups.map(g => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>

          <select value={tpa} onChange={e => setTpa(e.target.value)}>
            <option value="">All TPAs</option>
            {tpas.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>

          <button className="btn search" onClick={applyFilters}>Search</button>
          <button className="btn reset" onClick={resetFilters}>Reset</button>
        </div>

        {showResultInfo && (
          <div className="result-info">
            {resultSummary}
          </div>
        )}

        {/* TABLE */}
        <table>
          <thead>
            <tr>
              <th>Patient Name</th>
              <th>AL Number</th>
              <th>Policy No</th>
              <th>Hospital Group</th>
              <th>TPA</th>
              <th>Parsed Time</th>
              <th>Saved Time</th>
              <th>TAT</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {filteredCases.map(row => (
              <tr key={row.id}>
                <td>{row.patient_name}</td>
                <td>{row.al_number || "-"}</td>
                <td>{row.policy_number || "-"}</td>
                <td>{row.hospital_group}</td>
                <td>{row.tpa_name}</td>
                <td>{row.parsed_time ? new Date(row.parsed_time).toLocaleString() : "-"}</td>
                <td>{row.saved_time ? new Date(row.saved_time).toLocaleString() : "-"}</td>
                <td>{calculateTAT(row.parsed_time, row.saved_time)}</td>
                <td>
                  <span className={`status ${row.status.toLowerCase()}`}>
                    {row.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

      </div>
    </>
  );
}

export default App;
