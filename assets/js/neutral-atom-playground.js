/* =========================================================
   NEUTRAL ATOM PLAYGROUND
   ========================================================= */


/* =========================================================
   STEP DATA
   ========================================================= */

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

        simulation: "cooling"
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

        simulation: "tweezers"
    },


    {
        title: "Build a perfect array.",

        description:
            "Atoms can be moved between trapping sites to assemble a defect-free quantum register.",

        label: "ATOM REARRANGEMENT",

        button: "Continue →",

        simulation: "rearrangement"
    },


    {
        title: "Turn atoms into a quantum computer.",

        description:
            "Internal atomic states become qubits. Laser pulses manipulate individual qubits and create entanglement between atoms.",

        label: "QUANTUM COMPUTATION",

        button: "Restart ↻",

        simulation: "quantum"
    }

];


/* =========================================================
   STATE
   ========================================================= */

let currentStep = 0;


/* =========================================================
   DOM ELEMENTS
   ========================================================= */

const simulation =
    document.getElementById("simulation");

const simulationContent =
    document.getElementById("simulation-content");

const stepTitle =
    document.getElementById("step-title");

const stepDescription =
    document.getElementById("step-description");

const simulationLabel =
    document.getElementById("simulation-label");

const currentStepDisplay =
    document.getElementById("current-step");

const nextButton =
    document.getElementById("next-button");

const previousButton =
    document.getElementById("previous-button");

const stepButtons =
    document.querySelectorAll(".step");

const progressFill =
    document.querySelector(".progress-fill");


/* =========================================================
   SIMULATION FUNCTIONS
   ========================================================= */


/*
 * STEP 1
 *
 * Create a cloud of hot atoms.
 */
function createHotAtomSimulation() {

    simulationContent.innerHTML = "";


    /*
     * Create seven atoms.
     */
    for (let i = 1; i <= 7; i++) {

        const atom =
            document.createElement("div");

        atom.classList.add(
            "atom",
            `atom-${i}`
        );

        simulationContent.appendChild(atom);
    }
}


/*
 * STEP 2
 *
 * Placeholder for laser cooling.
 */
function createCoolingSimulation() {

    simulationContent.innerHTML = "";

    /*
     * We will build this next.
     */
}


/*
 * STEP 3
 *
 * Placeholder for conveyor-belt transport.
 */
function createTransportSimulation() {

    simulationContent.innerHTML = "";

    /*
     * We will build this after cooling.
     */
}


/*
 * STEP 4
 *
 * Placeholder for optical tweezers.
 */
function createTweezerSimulation() {

    simulationContent.innerHTML = "";

    /*
     * We will build this later.
     */
}


/*
 * STEP 5
 *
 * Placeholder for atom rearrangement.
 */
function createRearrangementSimulation() {

    simulationContent.innerHTML = "";

    /*
     * We will build this later.
     */
}


/*
 * STEP 6
 *
 * Placeholder for quantum computation.
 */
function createQuantumSimulation() {

    simulationContent.innerHTML = "";

    /*
     * We will build this later.
     */
}


/* =========================================================
   SELECT SIMULATION
   ========================================================= */

function updateSimulation(step) {

    /*
     * Remove all simulation-specific classes.
     */
    simulation.classList.remove(
        "hot-atoms",
        "cooling",
        "transport",
        "tweezers",
        "rearrangement",
        "quantum"
    );


    /*
     * Add the class belonging to
     * the current step.
     */
    simulation.classList.add(
        step.simulation
    );


    /*
     * Create the actual simulation.
     */
    switch (step.simulation) {

        case "hot-atoms":
            createHotAtomSimulation();
            break;

        case "cooling":
            createCoolingSimulation();
            break;

        case "transport":
            createTransportSimulation();
            break;

        case "tweezers":
            createTweezerSimulation();
            break;

        case "rearrangement":
            createRearrangementSimulation();
            break;

        case "quantum":
            createQuantumSimulation();
            break;
    }
}


/* =========================================================
   UPDATE ENTIRE STEP
   ========================================================= */

function updateStep() {

    const step =
        steps[currentStep];


    /*
     * Update text.
     */

    stepTitle.textContent =
        step.title;

    stepDescription.textContent =
        step.description;

    simulationLabel.textContent =
        step.label;

    currentStepDisplay.textContent =
        String(currentStep + 1)
            .padStart(2, "0");

    nextButton.textContent =
        step.button;


    /*
     * Update navigation.
     */

    stepButtons.forEach(
        (button, index) => {

            button.classList.toggle(
                "active",
                index === currentStep
            );
        }
    );


    /*
     * Update progress bar.
     */

    const progress =
        (currentStep / (steps.length - 1)) * 100;

    progressFill.style.width =
        `${progress}%`;


    /*
     * Update simulation.
     */

    updateSimulation(step);
}


/* =========================================================
   NEXT BUTTON
   ========================================================= */

nextButton.addEventListener(
    "click",
    () => {

        if (currentStep < steps.length - 1) {

            currentStep++;

        } else {

            /*
             * Restart at the beginning.
             */
            currentStep = 0;
        }

        updateStep();
    }
);


/* =========================================================
   PREVIOUS BUTTON
   ========================================================= */

previousButton.addEventListener(
    "click",
    () => {

        if (currentStep > 0) {

            currentStep--;

            updateStep();
        }
    }
);


/* =========================================================
   STEP NAVIGATION BUTTONS
   ========================================================= */

stepButtons.forEach(
    (button, index) => {

        button.addEventListener(
            "click",
            () => {

                currentStep = index;

                updateStep();
            }
        );
    }
);


/* =========================================================
   INITIALIZE
   ========================================================= */

updateStep();