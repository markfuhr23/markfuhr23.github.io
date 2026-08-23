const steps = [
    {
        title: "Atoms are everywhere.",
        description:
            "Before an atom can become a qubit, we first need to isolate and control it. At room temperature, atoms move extremely fast and randomly.",
        label: "HOT ATOM CLOUD",
        button: "Start cooling →",
        simulation: "hot-atoms"
    },

    {
        title: "First, we slow them down.",
        description:
            "Laser light can exert a force on atoms. By carefully tuning the lasers, we can repeatedly scatter photons from atoms and reduce their velocity.",
        label: "LASER COOLING",
        button: "Continue →",
        simulation: "cooling",

    },

    {
        title: "Then, we transport them somewhere more quiet.",
        description:
            "Cooling and hot atoms introduce a lot of noise. We can move the atoms into a vacuum chamber to isolate them from the environment.",
        label: "CONVEYOR BELT",
        button: "Continue →",
        simulation: "transport"
    },

    {
        title: "Capture individual atoms.",
        description:
            "Once sufficiently cold, atoms can be trapped using tightly focused laser beams called optical tweezers.",
        label: "OPTICAL TWEEZERS",
        button: "Continue →",
        simulation: "trapping"
    },

    {
        title: "Build a perfect array.",
        description:
            "Atoms can be moved between trapping sites to assemble a defect-free quantum register.",
        label: "ATOM REARRANGEMENT",
        button: "Continue →",
        simulation: "resorting"
    },

    {
        title: "Turn atoms into a quantum computer.",
        description:
            "Internal atomic states become qubits. Laser pulses manipulate individual qubits and create entanglement between atoms.",
        label: "QUANTUM COMPUTATION",
        button: "Restart ↻",
        simulation: "quantum-computing"
    }
];


let currentStep = 0;


const simulation = document.querySelector(".simulation");

const stepTitle = document.getElementById("step-title");
const stepDescription = document.getElementById("step-description");
const simulationLabel = document.getElementById("simulation-label");
const currentStepDisplay = document.getElementById("current-step");

const nextButton = document.getElementById("next-button");
const previousButton = document.getElementById("previous-button");

const stepButtons = document.querySelectorAll(".step");
const progressFill = document.querySelector(".progress-fill");


function updateStep() {

    const step = steps[currentStep];


    /* Update text */

    stepTitle.textContent = step.title;

    stepDescription.textContent = step.description;

    simulationLabel.textContent = step.label;

    currentStepDisplay.textContent =
        String(currentStep + 1).padStart(2, "0");

    nextButton.textContent = step.button;


    /* Update navigation */

    stepButtons.forEach((button, index) => {

        button.classList.toggle(
            "active",
            index === currentStep
        );

    });


    /* Update progress bar */

    const progress =
        (currentStep / (steps.length - 1)) * 100;

    progressFill.style.width = `${progress}%`;


    /* Reset simulation states */

    simulation.classList.remove(
        "hot-atoms",
        "cooling",
        "transport",
        "trapping",
        "resorting",
        "quantum-computing"
    );
    /* Activate simulation state */
    simulation.classList.add(step.simulation);
}


nextButton.addEventListener("click", () => {
    if (currentStep < steps.length - 1) {
        currentStep++;
    } else {
        currentStep = 0;
    }
    updateStep();
});


previousButton.addEventListener("click", () => {
    if (currentStep > 0) {

        currentStep--;

        updateStep();
    }
});


stepButtons.forEach((button, index) => {

    button.addEventListener("click", () => {

        currentStep = index;

        updateStep();

    });

});


updateStep();