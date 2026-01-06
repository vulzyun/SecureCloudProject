#!/usr/bin/env python3
"""
Script de test pour l'endpoint de création d'utilisateur
"""

import requests
import json

API_BASE = "http://127.0.0.1:8000"

def test_create_user():
    """Test de création d'un utilisateur"""
    print("🧪 Test: Création d'un utilisateur")
    
    payload = {
        "username": "test_user",
        "role": "dev",
        "email": "test@example.com"
    }
    
    try:
        response = requests.post(
            f"{API_BASE}/api/admin/users",
            json=payload,
            headers={"Content-Type": "application/json"}
        )
        
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            user = response.json()
            print("✅ Utilisateur créé avec succès!")
            print(json.dumps(user, indent=2))
        else:
            print(f"❌ Erreur: {response.text}")
            
    except Exception as e:
        print(f"❌ Exception: {e}")


def test_get_users():
    """Test de récupération des utilisateurs"""
    print("\n🧪 Test: Récupération de la liste des utilisateurs")
    
    try:
        response = requests.get(
            f"{API_BASE}/api/admin/users",
            headers={"Content-Type": "application/json"}
        )
        
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            users = response.json()
            print(f"✅ {len(users)} utilisateur(s) trouvé(s)")
            for user in users:
                print(f"  - {user['username']} ({user['role']}) - {user['email']}")
        else:
            print(f"❌ Erreur: {response.text}")
            
    except Exception as e:
        print(f"❌ Exception: {e}")


def test_update_user_role():
    """Test de mise à jour du rôle d'un utilisateur"""
    print("\n🧪 Test: Mise à jour du rôle d'un utilisateur (ID=1)")
    
    payload = {
        "role": "admin"
    }
    
    try:
        response = requests.put(
            f"{API_BASE}/api/admin/users/1/role",
            json=payload,
            headers={"Content-Type": "application/json"}
        )
        
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            print("✅ Rôle mis à jour avec succès!")
            print(json.dumps(result, indent=2))
        else:
            print(f"❌ Erreur: {response.text}")
            
    except Exception as e:
        print(f"❌ Exception: {e}")


def test_get_me():
    """Test de récupération de l'utilisateur courant"""
    print("\n🧪 Test: Récupération de l'utilisateur courant")
    
    try:
        response = requests.get(
            f"{API_BASE}/api/me",
            headers={"Content-Type": "application/json"}
        )
        
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            user = response.json()
            print("✅ Utilisateur courant récupéré!")
            print(json.dumps(user, indent=2))
        else:
            print(f"❌ Erreur: {response.text}")
            
    except Exception as e:
        print(f"❌ Exception: {e}")


def test_get_pipelines():
    """Test de récupération des pipelines"""
    print("\n🧪 Test: Récupération de la liste des pipelines")
    
    try:
        response = requests.get(
            f"{API_BASE}/api/pipelines",
            headers={"Content-Type": "application/json"}
        )
        
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            pipelines = response.json()
            print(f"✅ {len(pipelines)} pipeline(s) trouvé(s)")
            for pipeline in pipelines:
                print(f"  - {pipeline['name']} ({pipeline['status']}) - créé par {pipeline.get('created_by', 'N/A')}")
        else:
            print(f"❌ Erreur: {response.text}")
            
    except Exception as e:
        print(f"❌ Exception: {e}")


def test_create_pipeline():
    """Test de création d'un pipeline"""
    print("\n🧪 Test: Création d'un pipeline")
    
    payload = {
        "name": "Test Pipeline",
        "github_url": "https://github.com/test/repo"
    }
    
    try:
        response = requests.post(
            f"{API_BASE}/api/pipelines",
            json=payload,
            headers={"Content-Type": "application/json"}
        )
        
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            pipeline = response.json()
            print("✅ Pipeline créé avec succès!")
            print(json.dumps(pipeline, indent=2))
        else:
            print(f"❌ Erreur: {response.text}")
            
    except Exception as e:
        print(f"❌ Exception: {e}")


if __name__ == "__main__":
    print("=" * 60)
    print("🚀 Tests des endpoints Backend-Frontend")
    print("=" * 60)
    print("\n⚠️  Note: Ces tests supposent que le backend est en cours d'exécution")
    print(f"   sur {API_BASE}\n")
    
    # Tests des utilisateurs
    test_get_users()
    test_create_user()
    test_get_users()
    test_update_user_role()
    test_get_me()
    
    # Tests des pipelines
    test_get_pipelines()
    test_create_pipeline()
    test_get_pipelines()
    
    print("\n" + "=" * 60)
    print("✅ Tests terminés!")
    print("=" * 60)
