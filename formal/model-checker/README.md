# Independent finite-state checker

`reachability.py` explores the abstract EFSM and runs mutation tests. The baseline must have zero unsafe states/edges and a reachable commit. Each intentional mutation must create the corresponding counterexample.

```bash
python3 reachability.py --output report.json
```
