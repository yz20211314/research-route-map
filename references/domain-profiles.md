# Domain rigor profiles

Select one primary `domain_profile`. These profiles are applicability checklists, not automatic research-design decisions. Record an item as `not_applicable` with a reason or `pending` when the user must supply it.

## `general`

- research objective and boundary;
- object/sample/data source;
- work-package-to-method mapping;
- indicators or decision criteria;
- validation/triangulation;
- limitations, resources, and intended outputs.

## `experimental-biomedical`

- model, sample, inclusion/exclusion, and biological variables;
- experimental and control/comparator groups;
- sample-size or power rationale when applicable;
- randomization, allocation concealment, and blinding when applicable;
- primary/secondary endpoints and analysis plan;
- technical and biological replication;
- key resource authentication;
- perturbation/rescue or orthogonal validation;
- ethics, biosafety, and approvals;
- translational boundary and generalizability.

## `clinical-interventional`

- population, setting, eligibility, recruitment, and consent;
- intervention, comparator, allocation, blinding, and follow-up;
- primary/secondary outcomes and harms;
- sample-size/power and analysis population;
- missing data, protocol deviations, and stopping rules;
- registration, protocol, ethics, and data monitoring;
- implementation context and external validity.

Use current SPIRIT/CONSORT guidance when applicable.

## `computational-data`

- task definition and target population/system;
- dataset provenance, license, cohort/split, and leakage controls;
- preprocessing and feature/representation pipeline;
- baselines and ablations;
- training/tuning/test separation;
- metrics, uncertainty, calibration, and error analysis;
- internal, external, temporal, or cross-domain validation;
- robustness, fairness, privacy, and security when applicable;
- code, environment, data availability, and reproducibility;
- deployment constraints and monitoring.

Use a domain-specific reporting guideline such as TRIPOD+AI when applicable.

## `engineering-design`

- need, stakeholders, operating context, and system boundary;
- requirements and measurable performance targets;
- architecture, alternatives, and interfaces;
- prototype/build process;
- test environment, baselines, and acceptance criteria;
- safety, reliability, failure modes, and risk controls;
- iteration logic and decision gates;
- integration, deployment, maintainability, and resource constraints.

## `social-policy`

- population/territory/unit and comparison logic;
- theory, institutional context, and construct definitions;
- data/source/sampling and measurement validity;
- descriptive diagnosis and heterogeneity;
- identification, mechanism, configuration, or triangulation strategy;
- robustness, negative cases, reflexivity, and transferability;
- stakeholder/ethics considerations;
- differentiated paths, implementation conditions, monitoring, and feedback.

## `evidence-synthesis`

- review question and protocol/registration;
- information sources and reproducible search;
- eligibility and screening;
- extraction and risk-of-bias/quality appraisal;
- synthesis method and heterogeneity;
- certainty of evidence;
- sensitivity/subgroup analysis;
- exclusion counts/reasons and study-flow diagram;
- limitations and recommendation boundary.

Use the applicable PRISMA family guidance. A reporting checklist supports transparent reporting but does not replace review-method decisions.
