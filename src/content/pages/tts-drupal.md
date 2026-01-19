---
title: Drupal
author: Kyle Skrinak
permalink: /pages/tts-drupal.html
toc: false
excerpt: My thoughts on all things academic Drupal development and management
image: /assets/images/drupal_logo.png
categories:
  - "Drupal"
---


## Summary

My thoughts on the open-source CMS Drupal and managing Drupal development at Duke University's Trinity College of Arts &amp; Sciences.

## My most recent Drupal-related posts

<div class="relatedPosts">
  
{% assign maxRelated = 8 %}
{% assign minCommonTags =  1 %}
{% assign maxRelatedCounter = 0 %}

{% for post in site.posts %}

    {% assign sameTagCount = 0 %}
    {% assign commonTags = '' %}

    {% for category in post.categories %}
      {% if post.url != page.url %}
        {% if page.categories contains category %}
          {% assign sameTagCount = sameTagCount | plus: 1 %}
          {% capture tagmarkup %} <span class="label label-default">{{ category }}</span> {% endcapture %}
          {% assign commonTags = commonTags | append: tagmarkup %}
        {% endif %}
      {% endif %}
    {% endfor %}

    {% if sameTagCount >= minCommonTags %}
      <div>
      <p><a href="{{ post.url }}">{{ post.title }}{{ commonTags }}</a></p>
      </div>
      {% assign maxRelatedCounter = maxRelatedCounter | plus: 1 %}
      {% if maxRelatedCounter >= maxRelated %}
        {% break %}
      {% endif %}
    {% endif %}

  {% endfor %}

</div>
