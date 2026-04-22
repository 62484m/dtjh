import subprocess
import sys

def install_and_run():
    subprocess.check_call([sys.executable, "-m", "pip", "install", "akshare", "pandas"])
    
    script = """
import akshare as ak
df = ak.fund_etf_spot_em()
target = df[df['代码'] == '159501']
print(target.to_dict('records'))
"""
    with open("test_ak.py", "w") as f:
        f.write(script)
        
    subprocess.check_call([sys.executable, "test_ak.py"])

install_and_run()
