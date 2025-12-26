import React from 'react'

export default function Home() {
  return (
    <div style={{ padding: '2rem' }}>
      <h1>Analytics Platform</h1>
      <p>Welcome to the Analytics Platform Dashboard</p>
      <div style={{ marginTop: '2rem' }}>
        <h2>Services</h2>
        <ul>
          <li>
            <a href="http://localhost:3000">Analytics API</a>
          </li>
          <li>
            <a href="http://localhost:8000">ML Service</a>
          </li>
          <li>
            <a href="http://localhost:3002">Grafana Dashboards</a>
          </li>
          <li>
            <a href="http://localhost:16686">Jaeger Tracing</a>
          </li>
          <li>
            <a href="http://localhost:9090">Prometheus</a>
          </li>
          <li>
            <a href="http://localhost:9001">MinIO Console</a>
          </li>
        </ul>
      </div>
    </div>
  )
}
