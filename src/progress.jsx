import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";

function ProgressBar({ speed }) {
    const [percent, setPercent] = useState(0);
    const done = percent === 100;

    useEffect(() => {
        if (done) return;
        const id = setInterval(() => {
            setPercent(value => Math.min(100, value + 1));
        }, speed);
        return () => clearInterval(id);
    }, [speed, done]);

    return <section className="panel">
        <div className="row"><h2>Шаг 1% за {speed} мс</h2>
            <output>{percent}%</output></div>
        <div className="track" role="progressbar" aria-label={`Шаг за ${speed} мс`}
             aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
            <div className="fill" style={{ width: percent + "%" }} />
        </div>
        {done && <div className="row finish">
            <strong>Готово!</strong>
            <button onClick={() => setPercent(0)}>Заново</button>
        </div>}
    </section>;
}

createRoot(document.getElementById("root")).render(
    <><ProgressBar speed={50} /><ProgressBar speed={150} /></>
);
